create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'driver');
create type public.document_type as enum ('driver_license', 'medical_certificate', 'identity_proof', 'driving_history', 'right_to_work', 'nhvas_bfm_certificate', 'dangerous_goods_license');
create type public.document_status as enum ('pending', 'approved', 'rejected');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  address text,
  preferred_language text default 'English',
  role public.user_role not null default 'driver',
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'Not Started' check (status in ('Not Started', 'In Progress', 'Completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.induction_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  current_step int not null default 1,
  completion_percentage int not null default 0,
  quiz_score int,
  completed boolean not null default false,
  completed_step_ids int[] not null default '{}',
  declaration_accepted boolean not null default false,
  declaration_agreed_at timestamptz,
  signature text,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_url text not null,
  type public.document_type not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  status public.document_status not null default 'pending',
  rejection_reason text,
  verified_by_admin boolean not null default false,
  expires_at timestamptz,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score int not null,
  passed boolean not null,
  attempt_number int not null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_sections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  format text not null,
  summary text not null,
  sort_order int not null,
  video_url text,
  video_duration_seconds int default 0,
  require_full_watch boolean not null default false,
  version text not null default '1.0',
  effective_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.learning_section_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  section_id uuid not null references public.learning_sections(id) on delete cascade,
  section_version text not null default '1.0',
  completed boolean not null default false,
  section_started_at timestamptz,
  completed_at timestamptz,
  unique (user_id, section_id, section_version)
);


create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  options jsonb not null,
  correct_answer int not null,
  explanation text not null,
  sort_order int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  completion_id text not null unique,
  verification_code text not null unique,
  verification_url text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  correlation_id uuid default gen_random_uuid(),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  clarity_rating int not null check (clarity_rating between 1 and 5),
  issues text not null default '',
  submitted_at timestamptz not null default now()
);

alter table public.induction_progress add column if not exists declaration_agreed_at timestamptz;

-- v1.0.1 Migrations: Strict compliance columns
alter table public.documents add column if not exists status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'));
alter table public.documents add column if not exists verified_by_admin boolean not null default false;
alter table public.audit_logs add column if not exists correlation_id uuid default gen_random_uuid();

-- Indexes
create unique index if not exists documents_user_type_idx on public.documents (user_id, type);
create index if not exists documents_status_idx on public.documents (status, uploaded_at desc);
create index if not exists audit_logs_user_created_idx on public.audit_logs (user_id, created_at desc);
create index if not exists audit_logs_action_created_idx on public.audit_logs (action, created_at desc);
create index if not exists driver_feedback_submitted_idx on public.driver_feedback (submitted_at desc);

create or replace function public.handle_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_completed_induction_changes()
returns trigger
language plpgsql
as $$
begin
  if old.completed then
    raise exception 'Completed induction records are locked for compliance.';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_audit_log_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit logs are immutable.';
end;
$$;

-- Handle Expired Renewals
create or replace function public.reset_expired_inductions()
returns void
language plpgsql
security definer
as $$
begin
  -- Identify drivers whose certificate OR any mandatory document has expired
  update public.induction_progress
  set completed = false,
      current_step = 1,
      completed_at = null,
      updated_at = now(),
      completed_step_ids = '{}',
      quiz_score = null,
      declaration_accepted = false
  where user_id in (
    select user_id from public.certificates
    where expires_at < now()
    union
    select user_id from public.documents
    where expires_at < now()
  );

  update public.drivers
  set status = 'Not Started'
  where user_id in (
    select user_id from public.certificates
    where expires_at < now()
    union
    select user_id from public.documents
    where expires_at < now()
  );

  -- Delete expired certificates forcing a re-issue
  delete from public.certificates where expires_at < now();
  
  -- Update status of expired documents to pending so they need to be re-uploaded
  update public.documents set status = 'pending', verified_by_admin = false where expires_at < now();
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute procedure public.handle_profile_updated_at();

drop trigger if exists induction_progress_locked_after_completion on public.induction_progress;
create trigger induction_progress_locked_after_completion
before update on public.induction_progress
for each row
when (old.completed = true)
execute procedure public.prevent_completed_induction_changes();

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update
before update on public.audit_logs
for each row execute procedure public.prevent_audit_log_changes();

drop trigger if exists audit_logs_no_delete on public.audit_logs;
create trigger audit_logs_no_delete
before delete on public.audit_logs
for each row execute procedure public.prevent_audit_log_changes();

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin'
  );
$$;

create or replace function public.delete_user_by_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized: Only admins can delete users';
  end if;
  
  delete from auth.users where id = target_user_id;
end;
$$;

create extension if not exists pgcrypto;

create or replace function public.create_user_by_admin(
  new_email text,
  new_password text,
  new_full_name text,
  new_phone text,
  new_address text,
  new_language text
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_user_id uuid;
  encrypted_pw text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized: Only admins can create users';
  end if;

  encrypted_pw := crypt(new_password, gen_salt('bf'));
  new_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', new_email, encrypted_pw, now(), 
    null, null, '{"provider":"email","providers":["email"]}', '{}', 
    now(), now(), '', '', '', ''
  );
  
  insert into auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_user_id, format('{"sub":"%s","email":"%s"}', new_user_id, new_email)::jsonb, 'email', null, now(), now()
  );

  insert into public.profiles (id, role, full_name) values (new_user_id, 'driver', new_full_name);
  
  insert into public.drivers (id, email, phone, address, preferred_language) 
  values (new_user_id, new_email, new_phone, new_address, new_language);
  
  return new_user_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.induction_progress enable row level security;
alter table public.documents enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.learning_sections enable row level security;
alter table public.learning_section_completions enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.certificates enable row level security;
alter table public.audit_logs enable row level security;
alter table public.driver_feedback enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
on public.profiles for select
using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update"
on public.profiles for update
using (auth.uid() = id or public.is_admin(auth.uid()))
with check (auth.uid() = id or public.is_admin(auth.uid()));

create or replace function check_profiles_update_columns()
returns trigger as $$
begin
  if not public.is_admin(auth.uid()) then
    if new.role is distinct from old.role then
      raise exception 'Not authorized to change role';
    end if;
    if new.must_change_password is distinct from old.must_change_password then
      raise exception 'Not authorized to change must_change_password';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_profiles_update_columns on public.profiles;
create trigger enforce_profiles_update_columns
before update on public.profiles
for each row
execute function check_profiles_update_columns();

drop policy if exists "drivers_select" on public.drivers;
create policy "drivers_select"
on public.drivers for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "drivers_update_admin" on public.drivers;
create policy "drivers_update_admin"
on public.drivers for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "drivers_insert_admin" on public.drivers;
create policy "drivers_insert_admin"
on public.drivers for insert
with check (public.is_admin(auth.uid()));

drop policy if exists "induction_progress_select" on public.induction_progress;
create policy "induction_progress_select"
on public.induction_progress for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "induction_progress_upsert" on public.induction_progress;
create policy "induction_progress_upsert"
on public.induction_progress for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "documents_select" on public.documents;
create policy "documents_select"
on public.documents for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "documents_insert" on public.documents;
create policy "documents_insert"
on public.documents for insert
with check (
  (user_id = auth.uid() and status = 'pending' and verified_by_admin = false)
  or public.is_admin(auth.uid())
);

drop policy if exists "documents_update" on public.documents;
create policy "documents_update"
on public.documents for update
using (
  (user_id = auth.uid() and status in ('pending', 'rejected'))
  or public.is_admin(auth.uid())
)
with check (
  (user_id = auth.uid() and status = 'pending' and verified_by_admin = false)
  or public.is_admin(auth.uid())
);

drop policy if exists "documents_delete" on public.documents;
create policy "documents_delete"
on public.documents for delete
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "quiz_attempts_select" on public.quiz_attempts;
create policy "quiz_attempts_select"
on public.quiz_attempts for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "quiz_attempts_insert" on public.quiz_attempts;
create policy "quiz_attempts_insert"
on public.quiz_attempts for insert
with check (public.is_admin(auth.uid()));

drop policy if exists "learning_sections_select" on public.learning_sections;
create policy "learning_sections_select"
on public.learning_sections for select
using (true);

drop policy if exists "learning_sections_manage_admin" on public.learning_sections;
create policy "learning_sections_manage_admin"
on public.learning_sections for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "learning_completions_select" on public.learning_section_completions;
create policy "learning_completions_select"
on public.learning_section_completions for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "learning_completions_upsert" on public.learning_section_completions;
create policy "learning_completions_upsert"
on public.learning_section_completions for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "quiz_questions_select" on public.quiz_questions;
create policy "quiz_questions_select"
on public.quiz_questions for select
using (public.is_admin(auth.uid()));

drop policy if exists "quiz_questions_manage_admin" on public.quiz_questions;
create policy "quiz_questions_manage_admin"
on public.quiz_questions for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "certificates_select" on public.certificates;
create policy "certificates_select"
on public.certificates for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "certificates_insert_update" on public.certificates;
create policy "certificates_insert_update"
on public.certificates for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "audit_logs_select" on public.audit_logs;
create policy "audit_logs_select"
on public.audit_logs for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "audit_logs_insert" on public.audit_logs;
create policy "audit_logs_insert"
on public.audit_logs for insert
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "driver_feedback_select" on public.driver_feedback;
create policy "driver_feedback_select"
on public.driver_feedback for select
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "driver_feedback_upsert" on public.driver_feedback;
create policy "driver_feedback_upsert"
on public.driver_feedback for all
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'driver-documents',
  'driver-documents',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
on conflict (id) do update set
  file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

drop policy if exists "driver_documents_select" on storage.objects;
create policy "driver_documents_select"
on storage.objects for select
using (
  bucket_id = 'driver-documents'
  and (
    public.is_admin(auth.uid())
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists "driver_documents_insert" on storage.objects;
create policy "driver_documents_insert"
on storage.objects for insert
with check (
  bucket_id = 'driver-documents'
  and (
    public.is_admin(auth.uid())
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists "driver_documents_update" on storage.objects;
create policy "driver_documents_update"
on storage.objects for update
using (
  bucket_id = 'driver-documents'
  and (
    public.is_admin(auth.uid())
    or (storage.foldername(name))[1] = auth.uid()::text
  )
)
with check (
  bucket_id = 'driver-documents'
  and (
    public.is_admin(auth.uid())
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists "driver_documents_delete" on storage.objects;
create policy "driver_documents_delete"
on storage.objects for delete
using (
  bucket_id = 'driver-documents'
  and (
    public.is_admin(auth.uid())
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

insert into storage.buckets (id, name, public)
values ('identity-verification', 'identity-verification', false)
on conflict (id) do nothing;

drop policy if exists "identity_verification_select" on storage.objects;
create policy "identity_verification_select"
on storage.objects for select
using (
  bucket_id = 'identity-verification'
  and (
    public.is_admin(auth.uid())
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists "identity_verification_insert" on storage.objects;
create policy "identity_verification_insert"
on storage.objects for insert
with check (
  bucket_id = 'identity-verification'
  and (
    public.is_admin(auth.uid())
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists "identity_verification_update" on storage.objects;
create policy "identity_verification_update"
on storage.objects for update
using (
  bucket_id = 'identity-verification'
  and (
    public.is_admin(auth.uid())
    or (storage.foldername(name))[1] = auth.uid()::text
  )
)
with check (
  bucket_id = 'identity-verification'
  and (
    public.is_admin(auth.uid())
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

insert into public.learning_sections (title, format, summary, sort_order, video_url, video_duration_seconds, require_full_watch)
values
  ('Chain of Responsibility', 'video', 'Learn who can affect a transport job, what your responsibilities are, and when to speak up if something is unsafe.', 1, 'https://www.youtube.com/embed/Jt-R2-YjCQA', 120, true),
  ('Fatigue Management', 'video', 'Understand rest, fit-for-duty expectations, warning signs of fatigue, and what to do before driving tired.', 2, 'https://www.youtube.com/embed/kYmXWj8Yt00', 180, true),
  ('Load Restraint Basics', 'video', 'Review the basics of stable loading, restraint checks, and when to stop and fix a load before moving.', 3, 'https://www.youtube.com/embed/H7Zl9v9vU6U', 150, true),
  ('Speed & Compliance', 'video', 'See how delivery pressure, road rules, and safe driving decisions connect in everyday transport work.', 4, 'https://www.youtube.com/embed/4T1M-x7z-0I', 90, true),
  ('Vehicle Checks & Defect Reporting', 'video', 'Cover daily vehicle checks, defect reporting, and when a vehicle must not be driven.', 5, 'https://www.youtube.com/embed/w7d4J_lJvD8', 105, true),
  ('Site Safety & Loading Zones', 'video', 'Explain safe movement around depots, customers, forklifts, pedestrians, and loading areas.', 6, 'https://www.youtube.com/embed/jNQXAC9IVRw', 110, true),
  ('Incident Reporting & Emergency Response', 'video', 'Show what to do after an incident, near miss, injury, spill, or unsafe event.', 7, 'https://www.youtube.com/embed/tgbNymZ7vqY', 130, true),
  ('Mass, Dimension and Loading (MDL)', 'video', 'Understand weight limits, legal dimensions, and how to distribute loads to prevent breaches.', 8, 'https://www.youtube.com/embed/uG46j3k2_4A', 145, true),
  ('Work Health and Safety (WHS) & PPE', 'video', 'Identify common workplace hazards and know when and where to wear personal protective equipment.', 9, 'https://www.youtube.com/embed/v7B0P89Z-p8', 160, true),
  ('Drug and Alcohol Policy', 'video', 'Review company and legal expectations around being drug and alcohol-free while working.', 10, 'https://www.youtube.com/embed/z4G131k4t1A', 95, true),
  ('Heavy Vehicle National Law (HVNL) Overview', 'video', 'A summary of the core heavy vehicle laws and how they apply to your daily driving tasks.', 11, 'https://www.youtube.com/embed/q110X4S1b9Q', 170, true)
on conflict do nothing;

update public.learning_sections set
  format = 'video',
  summary = 'Learn who can affect a transport job, what your responsibilities are, and when to speak up if something is unsafe.',
  video_url = 'https://www.youtube.com/embed/Jt-R2-YjCQA',
  video_duration_seconds = 120,
  require_full_watch = true
where title = 'Chain of Responsibility';

update public.learning_sections set
  format = 'video',
  summary = 'Understand rest, fit-for-duty expectations, warning signs of fatigue, and what to do before driving tired.',
  video_url = 'https://www.youtube.com/embed/kYmXWj8Yt00',
  video_duration_seconds = 180,
  require_full_watch = true
where title = 'Fatigue Management';

update public.learning_sections set
  format = 'video',
  summary = 'Review the basics of stable loading, restraint checks, and when to stop and fix a load before moving.',
  video_url = 'https://www.youtube.com/embed/H7Zl9v9vU6U',
  video_duration_seconds = 150,
  require_full_watch = true
where title = 'Load Restraint Basics';

update public.learning_sections set
  format = 'video',
  summary = 'See how delivery pressure, road rules, and safe driving decisions connect in everyday transport work.',
  video_url = 'https://www.youtube.com/embed/4T1M-x7z-0I',
  video_duration_seconds = 90,
  require_full_watch = true
where title = 'Speed & Compliance';

update public.learning_sections set
  format = 'video',
  summary = 'Cover daily vehicle checks, defect reporting, and when a vehicle must not be driven.',
  video_url = 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  video_duration_seconds = 105,
  require_full_watch = true
where title = 'Vehicle Checks & Defect Reporting';

update public.learning_sections set
  format = 'video',
  summary = 'Explain safe movement around depots, customers, forklifts, pedestrians, and loading areas.',
  video_url = 'https://www.youtube.com/embed/jNQXAC9IVRw',
  video_duration_seconds = 110,
  require_full_watch = true
where title = 'Site Safety & Loading Zones';

update public.learning_sections set
  format = 'video',
  summary = 'Show what to do after an incident, near miss, injury, spill, or unsafe event.',
  video_url = 'https://www.youtube.com/embed/tgbNymZ7vqY',
  video_duration_seconds = 130,
  require_full_watch = true
where title = 'Incident Reporting & Emergency Response';

insert into public.quiz_questions (question, options, correct_answer, explanation, sort_order)
values
  ('Who shares responsibility when a transport job is planned or carried out unsafely?', '["Only the driver","Only the customer","Everyone who can influence the job","Only the loader"]'::jsonb, 2, 'Safety responsibility is shared by everyone who can influence the transport task.', 1),
  ('What is the best response if you are too tired to drive safely?', '["Keep driving and finish early","Report it and manage the task safely","Drink coffee and continue","Ignore it unless someone notices"]'::jsonb, 1, 'Fatigue should be reported and managed before it creates risk on the road.', 2),
  ('When should you check your load restraint?', '["Only at the depot","Before leaving and again when needed","Only after the job is done","Only if police ask"]'::jsonb, 1, 'Loads should be checked before departure and rechecked whenever conditions or the trip require it.', 3),
  ('If you are running late, what should you do?', '["Speed up to recover time","Skip a rest break","Call ahead and keep driving safely","Ignore the delivery time"]'::jsonb, 2, 'Safe driving and legal compliance still come first when a schedule changes.', 4),
  ('What should you do if a pre-start check finds a safety defect?', '["Drive carefully and mention it later","Report it straight away and do not drive if unsafe","Ignore it if the job is urgent","Ask another driver to sign it off"]'::jsonb, 1, 'Safety defects must be reported promptly, and unsafe vehicles must not be driven.', 5),
  ('What is the safest approach in a loading zone with forklifts and pedestrians nearby?', '["Move quickly before the area gets busier","Wait, follow site controls, and move only when the area is clear","Use the horn and keep going","Assume the site team will move for you"]'::jsonb, 1, 'Drivers should follow site rules, stay alert, and only move when the area is clearly safe.', 6),
  ('When should a near miss or unsafe incident be reported?', '["Only if there is vehicle damage","Only if police attend","As soon as possible, even if nobody was hurt","At the end of the month"]'::jsonb, 2, 'Near misses and unsafe events should be reported quickly so hazards can be addressed.', 7),
  ('Who is responsible for ensuring a vehicle is not overloaded?', '["Only the loading site","Only the driver","All parties in the supply chain (Chain of Responsibility)","Only the NHVR"]'::jsonb, 2, 'Under the HVNL, mass, dimension, and loading requirements are shared by all parties in the supply chain.', 8),
  ('When must high-visibility clothing and safety footwear be worn?', '["Only if the customer asks","Whenever you feel like it","As required by site rules and WHS policies","Only during the night"]'::jsonb, 2, 'PPE is mandatory according to specific site and company WHS policies.', 9),
  ('What is the legal blood alcohol concentration (BAC) limit for heavy vehicle drivers in Australia?', '["0.05","0.02","0.00 (Zero)","Depends on the state"]'::jsonb, 2, 'Heavy vehicle drivers must maintain a zero BAC while working.', 10),
  ('What does HVNL stand for?', '["Heavy Vehicle National License","Heavy Vehicle National Law","Heavy Volume National Logistics","Highway Vehicle Navigation Law"]'::jsonb, 1, 'HVNL stands for Heavy Vehicle National Law, which governs heavy vehicle operations in participating states.', 11)
on conflict do nothing;

update public.quiz_questions set
  question = 'Who shares responsibility when a transport job is planned or carried out unsafely?',
  options = '["Only the driver","Only the customer","Everyone who can influence the job","Only the loader"]'::jsonb,
  correct_answer = 2,
  explanation = 'Safety responsibility is shared by everyone who can influence the transport task.'
where sort_order = 1;

update public.quiz_questions set
  question = 'What is the best response if you are too tired to drive safely?',
  options = '["Keep driving and finish early","Report it and manage the task safely","Drink coffee and continue","Ignore it unless someone notices"]'::jsonb,
  correct_answer = 1,
  explanation = 'Fatigue should be reported and managed before it creates risk on the road.'
where sort_order = 2;

update public.quiz_questions set
  question = 'When should you check your load restraint?',
  options = '["Only at the depot","Before leaving and again when needed","Only after the job is done","Only if police ask"]'::jsonb,
  correct_answer = 1,
  explanation = 'Loads should be checked before departure and rechecked whenever conditions or the trip require it.'
where sort_order = 3;

update public.quiz_questions set
  question = 'If you are running late, what should you do?',
  options = '["Speed up to recover time","Skip a rest break","Call ahead and keep driving safely","Ignore the delivery time"]'::jsonb,
  correct_answer = 2,
  explanation = 'Safe driving and legal compliance still come first when a schedule changes.'
where sort_order = 4;

update public.quiz_questions set
  question = 'What should you do if a pre-start check finds a safety defect?',
  options = '["Drive carefully and mention it later","Report it straight away and do not drive if unsafe","Ignore it if the job is urgent","Ask another driver to sign it off"]'::jsonb,
  correct_answer = 1,
  explanation = 'Safety defects must be reported promptly, and unsafe vehicles must not be driven.'
where sort_order = 5;

update public.quiz_questions set
  question = 'What is the safest approach in a loading zone with forklifts and pedestrians nearby?',
  options = '["Move quickly before the area gets busier","Wait, follow site controls, and move only when the area is clear","Use the horn and keep going","Assume the site team will move for you"]'::jsonb,
  correct_answer = 1,
  explanation = 'Drivers should follow site rules, stay alert, and only move when the area is clearly safe.'
where sort_order = 6;

update public.quiz_questions set
  question = 'When should a near miss or unsafe incident be reported?',
  options = '["Only if there is vehicle damage","Only if police attend","As soon as possible, even if nobody was hurt","At the end of the month"]'::jsonb,
  correct_answer = 2,
  explanation = 'Near misses and unsafe events should be reported quickly so hazards can be addressed.'
where sort_order = 7;


-- ===========================
-- MIGRATIONS (001-005)
-- ===========================

-- ============================================================
-- Milestone 1: Workflow State Machine & Versioned Inductions
-- Additive migration — no existing tables or data are modified
-- ============================================================

-- Track induction content versions published by admins
create table if not exists public.induction_versions (
  id            uuid primary key default gen_random_uuid(),
  version_label text not null,               -- e.g. "2.0", "2024-Q2"
  revision_notes text not null default '',   -- what changed in this version
  published_by  uuid references public.profiles(id) on delete set null,
  published_at  timestamptz not null default now(),
  is_current    boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Ensure only one version is marked current at any time
create unique index if not exists induction_versions_current_idx
  on public.induction_versions (is_current)
  where is_current = true;

-- Soft-link induction_progress to the version it was started against
-- NULL means pre-versioning (legacy / original induction)
alter table public.induction_progress
  add column if not exists induction_version_id uuid
    references public.induction_versions(id) on delete set null;

-- Soft-link certificates to the version under which they were issued
alter table public.certificates
  add column if not exists induction_version_id uuid
    references public.induction_versions(id) on delete set null;

-- Index for fast lookups of progress by version
create index if not exists induction_progress_version_idx
  on public.induction_progress (induction_version_id);

-- Index for fast lookups of certificates by version
create index if not exists certificates_version_idx
  on public.certificates (induction_version_id);

-- RLS: Admins can manage all versions; drivers can only read the current version
alter table public.induction_versions enable row level security;

drop policy if exists "induction_versions_select" on public.induction_versions;
create policy "induction_versions_select"
  on public.induction_versions for select
  using (true);  -- any authenticated user can read version info

drop policy if exists "induction_versions_admin_manage" on public.induction_versions;
create policy "induction_versions_admin_manage"
  on public.induction_versions for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Seed the first version record representing the existing induction content
-- This links all existing records (pre-versioning) to a baseline "1.0" version
insert into public.induction_versions (version_label, revision_notes, is_current, created_at)
values ('1.0', 'Initial induction content — Chain of Responsibility, Fatigue Management, Load Restraint, Speed & Compliance, Vehicle Checks, Site Safety, Incident Reporting, Mass/Dimension, WHS & PPE, Drug & Alcohol, HVNL Overview.', true, now())
on conflict do nothing;

-- ============================================================
-- END OF MILESTONE 1 MIGRATION
-- ============================================================
-- ============================================================
-- Milestone 2: Randomised Question Bank, Critical Questions, Category Scoring
-- Additive migration — no existing columns or tables destroyed
-- ============================================================

-- 1. Add category and is_critical columns to quiz_questions
alter table public.quiz_questions
  add column if not exists category text not null default 'General',
  add column if not exists is_critical boolean not null default false;

-- 2. Add category_scores, failed_critical, and critical_questions_asked columns to quiz_attempts
alter table public.quiz_attempts
  add column if not exists category_scores jsonb not null default '{}'::jsonb,
  add column if not exists failed_critical boolean not null default false,
  add column if not exists critical_questions_asked integer not null default 0;

-- Index for category queries
create index if not exists quiz_questions_category_idx on public.quiz_questions (category);
create index if not exists quiz_questions_critical_idx on public.quiz_questions (is_critical);

-- Update existing 11 questions with categories & critical flags
update public.quiz_questions set category = 'Chain of Responsibility', is_critical = true where sort_order = 1;
update public.quiz_questions set category = 'Fatigue Management', is_critical = true where sort_order = 2;
update public.quiz_questions set category = 'Load Restraint', is_critical = false where sort_order = 3;
update public.quiz_questions set category = 'Speed & Compliance', is_critical = false where sort_order = 4;
update public.quiz_questions set category = 'Vehicle Checks & Defects', is_critical = true where sort_order = 5;
update public.quiz_questions set category = 'Site Safety & Loading Zones', is_critical = false where sort_order = 6;
update public.quiz_questions set category = 'Incident Reporting', is_critical = false where sort_order = 7;
update public.quiz_questions set category = 'Mass & Dimension', is_critical = false where sort_order = 8;
update public.quiz_questions set category = 'WHS & PPE', is_critical = false where sort_order = 9;
update public.quiz_questions set category = 'Drug & Alcohol', is_critical = true where sort_order = 10;
update public.quiz_questions set category = 'HVNL Law', is_critical = false where sort_order = 11;

-- Expand Question Bank Pool with additional heavy vehicle compliance questions
insert into public.quiz_questions (question, options, correct_answer, explanation, sort_order, category, is_critical)
values
  (
    'What is the maximum allowed driving hours in a standard 24-hour period under standard fatigue management rules?',
    '["12 hours","14 hours","16 hours","8 hours"]'::jsonb,
    0,
    'Under standard fatigue management rules, a solo driver must not exceed 12 hours of work/driving time in any 24-hour period.',
    12,
    'Fatigue Management',
    true
  ),
  (
    'What must a driver do if a load shifts during transit and threatens vehicle stability?',
    '["Continue at reduced speed","Stop in a safe place immediately and rectify the load restraint","Drive to the nearest customer","Ignore it if destination is near"]'::jsonb,
    1,
    'Unstable or shifted loads pose an immediate rollover hazard. Drivers must safely pull over and rectify restraint immediately.',
    13,
    'Load Restraint',
    true
  ),
  (
    'Under HVNL, who can be prosecuted if a driver is pressured to exceed legal mass limits?',
    '["Only the driver","Only the fleet owner","Both the driver and the scheduler/customer under Chain of Responsibility","Nobody if the delivery was completed"]'::jsonb,
    2,
    'Chain of Responsibility extends legal liability to all parties including schedulers, loaders, and customers who influence mass compliance.',
    14,
    'Chain of Responsibility',
    true
  ),
  (
    'What action is required if a random drug test returns a positive result at a logistics depot?',
    '["Driver is immediately stood down from driving duties","Driver is allowed to finish the day","Driver receives a verbal warning only","Driver can drive if feeling fine"]'::jsonb,
    0,
    'Heavy vehicle drivers must maintain zero drug and alcohol presence. A positive test mandates immediate stand-down.',
    15,
    'Drug & Alcohol',
    true
  ),
  (
    'When reversing a heavy vehicle in a crowded depot loading area, what is the safest practice?',
    '["Reverse quickly to avoid blocking traffic","Use a spotter or walk around the rear before reversing if view is obstructed","Rely solely on side mirrors","Honk horn and reverse without stopping"]'::jsonb,
    1,
    'Obstructed rear views cause severe depot accidents. Always walk around or use a trained spotter before reversing.',
    16,
    'Site Safety & Loading Zones',
    false
  ),
  (
    'What is the correct procedure when discovering a major brake line air leak during a daily pre-start check?',
    '["Drive carefully to a workshop","Tag out the vehicle, log defect, and do not drive until repaired","Fill air tanks and drive fast","Request permission from customer to drive"]'::jsonb,
    1,
    'Major defects like brake leaks render a heavy vehicle unroadworthy and strictly prohibited from operation.',
    17,
    'Vehicle Checks & Defects',
    true
  ),
  (
    'If an injury occurs on site during freight loading, within what timeframe must the incident be reported to the site safety officer?',
    '["Immediately","Within 24 hours","At the end of the week","Only if hospitalization occurs"]'::jsonb,
    0,
    'All workplace injuries must be reported immediately to ensure emergency assistance and WHS hazard containment.',
    18,
    'Incident Reporting',
    false
  ),
  (
    'What is the primary danger of driving a heavy vehicle with uneven lateral weight distribution?',
    '["Increased fuel consumption","Increased risk of rollover on curves or roundabouts","Slower acceleration","Uneven tire wear only"]'::jsonb,
    1,
    'Lateral imbalance drastically lowers the rollover threshold of heavy vehicles during turns.',
    19,
    'Mass & Dimension',
    false
  ),
  (
    'What safety equipment must be carried in all heavy transport vehicles operating under BNT Logistics WHS rules?',
    '["High-vis vest, safety boots, warning triangles, fire extinguisher, first aid kit","Only a spare tire","Sunglasses and gloves","None unless carrying dangerous goods"]'::jsonb,
    0,
    'Standard heavy vehicle safety kits include PPE, emergency warning triangles, fire extinguisher, and a first aid kit.',
    20,
    'WHS & PPE',
    false
  )
on conflict do nothing;

-- ============================================================
-- END OF MILESTONE 2 MIGRATION
-- ============================================================
-- Migration 003: Version-Aware Certificate Schema Fix
-- Remove single-column unique constraint on certificates(user_id)
-- Replace with composite unique constraint on (user_id, induction_version_id)
-- to allow multi-version certificate issuance per driver.

ALTER TABLE public.certificates DROP CONSTRAINT IF EXISTS certificates_user_id_key;
DROP INDEX IF EXISTS public.certificates_user_id_key;

-- Ensure induction_version_id column exists
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS induction_version_id uuid REFERENCES public.induction_versions(id);

-- Create composite unique index so a driver can hold 1 certificate per induction version
CREATE UNIQUE INDEX IF NOT EXISTS certificates_user_version_idx 
ON public.certificates (user_id, induction_version_id);
-- F-06: Atomic publish of induction versions to avoid TOCTOU window
CREATE OR REPLACE FUNCTION publish_induction_version(label text, notes text, publisher uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
BEGIN
  -- De-activate the current version
  UPDATE induction_versions
  SET is_current = false
  WHERE is_current = true;

  -- Insert the new version and mark it as current
  INSERT INTO induction_versions (version_label, revision_notes, published_by, is_current)
  VALUES (label, notes, publisher, true)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
-- Add video_duration_seconds to learning_sections
ALTER TABLE public.learning_sections 
ADD COLUMN IF NOT EXISTS video_duration_seconds int DEFAULT 0;

-- Add section_started_at to learning_section_completions
ALTER TABLE public.learning_section_completions 
ADD COLUMN IF NOT EXISTS section_started_at timestamptz;
