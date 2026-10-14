-- ============================================================
-- SOP Learning Modules: driver policy/reading modules with
-- per-driver completion tracking
-- Additive migration — no existing tables or data are modified
-- ============================================================

-- Module catalogue created by admins (read by all drivers)
create table if not exists public.sop_modules (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,           -- e.g. SOP-FAT-001
  name               text not null,
  category           text not null default 'SOP',    -- SOP | Policy & Procedure | Licensing | Product Inductions
  is_mandatory       boolean not null default false,
  content_summary    text not null default '',       -- the policy text the driver reads
  video_url          text,
  quiz_questions_count integer not null default 0,
  due_date           date,
  is_active          boolean not null default true,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- Per-driver completion record ("I have read this module")
create table if not exists public.sop_completions (
  id           uuid primary key default gen_random_uuid(),
  sop_id       uuid not null references public.sop_modules(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (sop_id, user_id)
);

-- Indexes for fast lookups
create index if not exists sop_modules_active_idx
  on public.sop_modules (is_active) where is_active = true;

create index if not exists sop_completions_user_idx
  on public.sop_completions (user_id);

-- RLS: any authenticated user can read the module catalogue
alter table public.sop_modules enable row level security;

drop policy if exists "sop_modules_select" on public.sop_modules;
create policy "sop_modules_select"
  on public.sop_modules for select
  using (auth.role() = 'authenticated');

drop policy if exists "sop_modules_admin_manage" on public.sop_modules;
create policy "sop_modules_admin_manage"
  on public.sop_modules for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- RLS: drivers see their own completions; admins see all
alter table public.sop_completions enable row level security;

drop policy if exists "sop_completions_select" on public.sop_completions;
create policy "sop_completions_select"
  on public.sop_completions for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Drivers record their own completion (upsert needs insert + update)
drop policy if exists "sop_completions_driver_insert" on public.sop_completions;
create policy "sop_completions_driver_insert"
  on public.sop_completions for insert
  with check (user_id = auth.uid());

drop policy if exists "sop_completions_driver_update" on public.sop_completions;
create policy "sop_completions_driver_update"
  on public.sop_completions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "sop_completions_admin_manage" on public.sop_completions;
create policy "sop_completions_admin_manage"
  on public.sop_completions for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
