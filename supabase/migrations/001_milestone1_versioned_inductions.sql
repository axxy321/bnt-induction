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
