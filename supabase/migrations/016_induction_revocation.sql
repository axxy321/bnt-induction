-- ============================================================
-- Migration 016: Induction Invitation Cancellation & Revocation
-- Adds tracking for cancelled invitations and revoked inductions with reasons
-- ============================================================

-- 1. Create induction_revocations table for tracking revoked inductions
create table if not exists public.induction_revocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  certificate_id uuid references public.certificates(id) on delete set null,
  schedule_enrollment_id uuid references public.induction_schedule_enrollments(id) on delete set null,
  revoked_by uuid not null references public.profiles(id) on delete cascade,
  revocation_type text not null check (revocation_type in ('cancel_invitation', 'revoke_induction')),
  reason text not null,
  previous_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists induction_revocations_user_idx on public.induction_revocations (user_id);
create index if not exists induction_revocations_certificate_idx on public.induction_revocations (certificate_id);
create index if not exists induction_revocations_enrollment_idx on public.induction_revocations (schedule_enrollment_id);
create index if not exists induction_revocations_created_idx on public.induction_revocations (created_at desc);

-- RLS for induction_revocations
alter table public.induction_revocations enable row level security;

drop policy if exists "induction_revocations_select" on public.induction_revocations;
create policy "induction_revocations_select"
  on public.induction_revocations for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "induction_revocations_admin_insert" on public.induction_revocations;
create policy "induction_revocations_admin_insert"
  on public.induction_revocations for insert
  with check (public.is_admin(auth.uid()));

-- 2. Add cancelled_at and cancelled_by to induction_schedule_enrollments for tracking
alter table public.induction_schedule_enrollments
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists cancellation_reason text;

-- 3. Add revoked_at and revoked_by to certificates for tracking
alter table public.certificates
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references public.profiles(id) on delete set null,
  add column if not exists revocation_reason text;

-- 4. Create index for revoked certificates
create index if not exists certificates_revoked_idx on public.certificates (revoked_at) where revoked_at is not null;

-- ============================================================
-- END OF MIGRATION 016
-- ============================================================