-- ============================================================
-- Slide-Based Induction Course Builder
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. induction_courses table
create table if not exists public.induction_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  template_id uuid references public.induction_courses(id) on delete set null,
  version_label text not null default '1.0',
  revision_notes text default '',
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  is_current boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure only one current version per course
create unique index if not exists induction_courses_current_idx
  on public.induction_courses (id)
  where is_current = true;

-- 2. induction_slides table
create table if not exists public.induction_slides (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.induction_courses(id) on delete cascade,
  slide_order int not null,
  slide_type text not null check (slide_type in ('video', 'text', 'image', 'audio', 'pdf', 'mixed', 'question')),
  title text not null,
  content_json jsonb not null default '{}'::jsonb,  -- rich text, images, formatting
  video_url text,
  audio_url text,
  forced_wait_seconds int not null default 0,
  estimated_duration_seconds int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists induction_slides_course_order_idx
  on public.induction_slides (course_id, slide_order);

-- 3. Add columns to quiz_questions for slide-based questions
alter table public.quiz_questions
  add column if not exists question_type text not null default 'single_choice'
    check (question_type in ('single_choice', 'multiple_choice', 'text_input')),
  add column if not exists slide_id uuid references public.induction_slides(id) on delete set null,
  add column if not exists placement text not null default 'separate_page'
    check (placement in ('below_slide', 'separate_page'));

create index if not exists quiz_questions_slide_idx on public.quiz_questions (slide_id);

-- 4. RLS for induction_courses
alter table public.induction_courses enable row level security;

drop policy if exists "induction_courses_select" on public.induction_courses;
create policy "induction_courses_select"
  on public.induction_courses for select
  using (true);

drop policy if exists "induction_courses_admin_manage" on public.induction_courses;
create policy "induction_courses_admin_manage"
  on public.induction_courses for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 5. RLS for induction_slides
alter table public.induction_slides enable row level security;

drop policy if exists "induction_slides_select" on public.induction_slides;
create policy "induction_slides_select"
  on public.induction_slides for select
  using (true);

drop policy if exists "induction_slides_admin_manage" on public.induction_slides;
create policy "induction_slides_admin_manage"
  on public.induction_slides for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 6. Storage bucket for induction assets (audio, images, PDFs)
-- Run this in Supabase Storage UI or via SQL:
-- insert into storage.buckets (id, name, public) values ('induction-assets', 'induction-assets', false)
-- on conflict (id) do nothing;

-- 7. Storage policies for induction-assets bucket
-- (Run after bucket exists)
-- create policy "induction_assets_select" on storage.objects for select using (bucket_id = 'induction-assets' and auth.role() = 'authenticated');
-- create policy "induction_assets_insert" on storage.objects for insert with check (bucket_id = 'induction-assets' and auth.role() = 'authenticated' and (storage.foldername(name))[1] = auth.uid()::text);
-- create policy "induction_assets_update" on storage.objects for update using (bucket_id = 'induction-assets' and auth.role() = 'authenticated' and (storage.foldername(name))[1] = auth.uid()::text);
-- create policy "induction_assets_delete" on storage.objects for delete using (bucket_id = 'induction-assets' and auth.role() = 'authenticated' and (storage.foldername(name))[1] = auth.uid()::text);

-- 8. Seed a default course from existing learning_sections (migration helper)
insert into public.induction_courses (title, description, version_label, is_current, created_by)
values ('BNT Logistics Heavy Vehicle Driver Induction', 'Standard 11-module induction covering CoR, Fatigue, Load Restraint, Speed, Vehicle Checks, Site Safety, Incident Reporting, Mass/Dimension, WHS/PPE, Drug & Alcohol, HVNL', '1.0', true, (select id from public.profiles where role = 'admin' limit 1))
on conflict do nothing;

-- ============================================================
-- END OF SLIDE COURSE BUILDER MIGRATION
-- ============================================================