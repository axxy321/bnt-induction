-- ============================================================
-- Driver Vehicles: heavy vehicles registered by drivers,
-- with REGO / DG / eSCBA compliance dates
-- Replaces the browser-local vehicle store with a shared table
-- Additive migration — no existing tables or data are modified
-- ============================================================

create table if not exists public.driver_vehicles (
  id                   text primary key,           -- client-generated (veh-…)
  user_id              uuid not null references public.profiles(id) on delete cascade,
  rego                 text not null,
  make_model           text not null,
  body_type            text,
  branch_name          text,
  driver_number        text,
  driver_name          text,
  rego_expiry_date     date,
  dg_expiry_date       date,                       -- Dangerous Goods licence
  scba_service_due_date date,                      -- eSCBA service due
  vehicle_check_approved boolean not null default false,
  rego_check_approved  boolean not null default false,
  status               text not null default 'Active',  -- Active | Inactive | Maintenance Required
  qr_pass_code         text,
  contact_number       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists driver_vehicles_user_idx
  on public.driver_vehicles (user_id);

create index if not exists driver_vehicles_rego_idx
  on public.driver_vehicles (rego);

-- RLS: drivers manage their own vehicles; admins see and manage all
alter table public.driver_vehicles enable row level security;

drop policy if exists "driver_vehicles_select" on public.driver_vehicles;
create policy "driver_vehicles_select"
  on public.driver_vehicles for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "driver_vehicles_driver_manage" on public.driver_vehicles;
create policy "driver_vehicles_driver_manage"
  on public.driver_vehicles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "driver_vehicles_admin_manage" on public.driver_vehicles;
create policy "driver_vehicles_admin_manage"
  on public.driver_vehicles for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
