-- ============================================================
-- Induction Schedule Feature
-- Allows admins to create schedules with multiple inductions
-- that auto-send invitations after specified delays
-- ============================================================

-- 1. induction_schedules table
create table if not exists public.induction_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  created_by uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. induction_schedule_items table
-- Links inductions (courses) in sequence with delays
create table if not exists public.induction_schedule_items (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.induction_schedules(id) on delete cascade,
  course_id uuid not null references public.induction_courses(id) on delete cascade,
  sequence_order int not null,
  delay_days int not null default 7,  -- days after previous induction completion to invite
  delay_type text not null default 'after_completion' check (delay_type in ('after_completion', 'after_enrollment', 'fixed_date')),
  fixed_date timestamptz,  -- used when delay_type = 'fixed_date'
  is_required boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists induction_schedule_items_schedule_idx
  on public.induction_schedule_items (schedule_id, sequence_order);

-- 3. induction_schedule_enrollments table
-- Tracks which drivers are enrolled in which schedule
create table if not exists public.induction_schedule_enrollments (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.induction_schedules(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  enrolled_by uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled', 'paused')),
  current_item_index int not null default 0,
  completed_at timestamptz,
  unique (schedule_id, driver_id)
);

create index if not exists induction_schedule_enrollments_driver_idx
  on public.induction_schedule_enrollments (driver_id, status);

-- 4. induction_schedule_invitations table
-- Tracks sent invitations for audit/troubleshooting
create table if not exists public.induction_schedule_invitations (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.induction_schedule_enrollments(id) on delete cascade,
  schedule_item_id uuid not null references public.induction_schedule_items(id) on delete cascade,
  sent_at timestamptz not null default now(),
  delivery_method text not null default 'email' check (delivery_method in ('email', 'in_app', 'sms')),
  status text not null default 'sent' check (status in ('sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists induction_schedule_invitations_enrollment_idx
  on public.induction_schedule_invitations (enrollment_id);

-- 5. RLS Policies

-- induction_schedules
alter table public.induction_schedules enable row level security;

drop policy if exists "induction_schedules_select" on public.induction_schedules;
create policy "induction_schedules_select"
  on public.induction_schedules for select
  using (auth.role() = 'authenticated');

drop policy if exists "induction_schedules_admin_manage" on public.induction_schedules;
create policy "induction_schedules_admin_manage"
  on public.induction_schedules for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- induction_schedule_items
alter table public.induction_schedule_items enable row level security;

drop policy if exists "induction_schedule_items_select" on public.induction_schedule_items;
create policy "induction_schedule_items_select"
  on public.induction_schedule_items for select
  using (auth.role() = 'authenticated');

drop policy if exists "induction_schedule_items_admin_manage" on public.induction_schedule_items;
create policy "induction_schedule_items_admin_manage"
  on public.induction_schedule_items for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- induction_schedule_enrollments
alter table public.induction_schedule_enrollments enable row level security;

drop policy if exists "induction_schedule_enrollments_select" on public.induction_schedule_enrollments;
create policy "induction_schedule_enrollments_select"
  on public.induction_schedule_enrollments for select
  using (
    driver_id = auth.uid() or
    public.is_admin(auth.uid())
  );

drop policy if exists "induction_schedule_enrollments_admin_manage" on public.induction_schedule_enrollments;
create policy "induction_schedule_enrollments_admin_manage"
  on public.induction_schedule_enrollments for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- induction_schedule_invitations
alter table public.induction_schedule_invitations enable row level security;

drop policy if exists "induction_schedule_invitations_select" on public.induction_schedule_invitations;
create policy "induction_schedule_invitations_select"
  on public.induction_schedule_invitations for select
  using (public.is_admin(auth.uid()));

drop policy if exists "induction_schedule_invitations_admin_manage" on public.induction_schedule_invitations;
create policy "induction_schedule_invitations_admin_manage"
  on public.induction_schedule_invitations for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- 6. Function to process schedule invitations (called by cron/pg_cron)
create or replace function public.process_induction_schedule_invitations()
returns void
language plpgsql
as $$
declare
  enrollment record;
  next_item record;
  invitation_record record;
  driver_email text;
  driver_name text;
  course_title text;
  schedule_name text;
  due_date timestamptz;
begin
  -- Find enrollments that are due for next invitation
  for enrollment in
    select e.*, s.name as schedule_name
    from public.induction_schedule_enrollments e
    join public.induction_schedules s on e.schedule_id = s.id
    where e.status = 'active'
    and e.current_item_index < (
      select count(*) from public.induction_schedule_items where schedule_id = e.schedule_id
    )
  loop
    -- Get the next schedule item
    select *
    into next_item
    from public.induction_schedule_items
    where schedule_id = enrollment.schedule_id
    and sequence_order = enrollment.current_item_index + 1
    order by sequence_order
    limit 1;

    if not found then
      continue;
    end if;

    -- Check if it's time to send invitation
    if next_item.delay_type = 'after_completion' then
      -- Check if previous induction was completed
      if enrollment.current_item_index > 0 then
        -- Check induction_progress for the previous course
        -- We'll use a simpler approach: check if enough time has passed since enrollment
        -- For production, you'd check induction_progress table for the specific course
        continue; -- Skip for now, implement with proper completion check
      end if;
    end if;

    -- For now, simple time-based check
    -- In production, you'd check actual completion of previous induction
    due_date := enrollment.enrolled_at + (next_item.delay_days || 7) * interval '1 day';

    if now() >= due_date then
      -- Check if invitation already sent for this item
      select *
      into invitation_record
      from public.induction_schedule_invitations
      where enrollment_id = enrollment.id
      and schedule_item_id = next_item.id
      limit 1;

      if not found then
        -- Get driver info
        select email, full_name
        into driver_email, driver_name
        from public.profiles
        where id = enrollment.driver_id;

        -- Get course title
        select title
        into course_title
        from public.induction_courses
        where id = next_item.course_id;

        -- Insert invitation record
        insert into public.induction_schedule_invitations (
          enrollment_id,
          schedule_item_id,
          delivery_method,
          status,
          metadata
        ) values (
          enrollment.id,
          next_item.id,
          'email',
          'sent',
          jsonb_build_object(
            'driver_email', driver_email,
            'driver_name', driver_name,
            'course_title', course_title,
            'schedule_name', enrollment.schedule_name,
            'delay_days', next_item.delay_days
          )
        );

        -- Update enrollment to next item
        update public.induction_schedule_enrollments
        set current_item_index = enrollment.current_item_index + 1
        where id = enrollment.id;

        -- TODO: Actually send email via external service (SendGrid, etc.)
        -- This would be triggered by a background job or webhook
      end if;
    end if;
  end loop;
end;
$$;

-- 7. Function to enroll a driver in a schedule
create or replace function public.enroll_driver_in_schedule(
  p_schedule_id uuid,
  p_driver_id uuid,
  p_enrolled_by uuid default null
)
returns public.induction_schedule_enrollments
language plpgsql
as $$
declare
  new_enrollment public.induction_schedule_enrollments;
begin
  insert into public.induction_schedule_enrollments (
    schedule_id,
    driver_id,
    enrolled_by,
    status,
    current_item_index
  ) values (
    p_schedule_id,
    p_driver_id,
    p_enrolled_by,
    'active',
    0
  )
  on conflict (schedule_id, driver_id) do update set
    status = 'active',
    current_item_index = 0,
    completed_at = null,
    enrolled_at = now()
  returning * into new_enrollment;

  return new_enrollment;
end;
$$;

-- Grant execute permissions
grant execute on function public.process_induction_schedule_invitations() to authenticated;
grant execute on function public.enroll_driver_in_schedule(uuid, uuid, uuid) to authenticated;

-- ============================================================
-- END OF INDUCTION SCHEDULE MIGRATION
-- ============================================================