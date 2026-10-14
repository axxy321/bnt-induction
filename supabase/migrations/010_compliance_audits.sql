-- ============================================================
-- Compliance Audits: admin-assigned safety audits with driver results
-- Additive migration — no existing tables or data are modified
-- ============================================================

-- Audit templates created by admins (questions stored as a JSON array of strings)
create table if not exists public.compliance_audits (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'Transport',  -- Transport | Work Health & Safety | Operational Risk | Fleet Compliance
  description text not null default '',
  questions   jsonb not null default '[]',        -- ["question 1", "question 2", ...]
  due_date    date,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Assignment of an audit to a driver
create table if not exists public.audit_assignments (
  id               uuid primary key default gen_random_uuid(),
  audit_id         uuid not null references public.compliance_audits(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  status           text not null default 'No Attempt',  -- No Attempt | In Progress | Passed | Action Required
  due_date         date,
  attempts_count   integer not null default 0,
  last_attempt_date timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  unique (audit_id, user_id)
);

-- Answers recorded per attempt (question_index -> answer true/false)
create table if not exists public.audit_responses (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.audit_assignments(id) on delete cascade,
  question_index integer not null,
  answer         boolean not null,
  submitted_at   timestamptz not null default now()
);

-- Indexes for fast lookups
create index if not exists compliance_audits_active_idx
  on public.compliance_audits (is_active) where is_active = true;

create index if not exists audit_assignments_user_idx
  on public.audit_assignments (user_id);

create index if not exists audit_responses_assignment_idx
  on public.audit_responses (assignment_id);

-- RLS: any authenticated user can read audit definitions
alter table public.compliance_audits enable row level security;

drop policy if exists "compliance_audits_select" on public.compliance_audits;
create policy "compliance_audits_select"
  on public.compliance_audits for select
  using (auth.role() = 'authenticated');

drop policy if exists "compliance_audits_admin_manage" on public.compliance_audits;
create policy "compliance_audits_admin_manage"
  on public.compliance_audits for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- RLS: drivers see and update their own assignments; admins manage all
alter table public.audit_assignments enable row level security;

drop policy if exists "audit_assignments_select" on public.audit_assignments;
create policy "audit_assignments_select"
  on public.audit_assignments for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "audit_assignments_admin_manage" on public.audit_assignments;
create policy "audit_assignments_admin_manage"
  on public.audit_assignments for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Drivers may update their own assignment status when submitting an attempt
drop policy if exists "audit_assignments_driver_update" on public.audit_assignments;
create policy "audit_assignments_driver_update"
  on public.audit_assignments for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- RLS: drivers read and submit answers for their own assignments
alter table public.audit_responses enable row level security;

drop policy if exists "audit_responses_select" on public.audit_responses;
create policy "audit_responses_select"
  on public.audit_responses for select
  using (
    exists (
      select 1 from public.audit_assignments a
      where a.id = audit_responses.assignment_id
        and (a.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "audit_responses_driver_insert" on public.audit_responses;
create policy "audit_responses_driver_insert"
  on public.audit_responses for insert
  with check (
    exists (
      select 1 from public.audit_assignments a
      where a.id = audit_responses.assignment_id
        and a.user_id = auth.uid()
    )
  );
