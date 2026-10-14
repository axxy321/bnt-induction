-- ============================================================
-- Contractor Profiles: contractor company & accreditation data
-- per driver, including insurance policy documents
-- Replaces the browser-local contractor store with a shared table
-- Additive migration — no existing tables or data are modified
-- ============================================================

-- Storage bucket for insurance / accreditation documents (public read
-- so gate staff and admins can open policy files directly).
insert into storage.buckets (id, name, public)
values ('contractor-documents', 'contractor-documents', true)
on conflict (id) do nothing;

create table if not exists public.contractor_profiles (
  user_id                   uuid primary key references public.profiles(id) on delete cascade,
  company_name              text not null default '',
  trading_name              text not null default '',
  abn                       text not null default '',
  contact_person            text not null default '',
  email                     text not null default '',
  phone                     text not null default '',
  address                   text not null default '',
  nhvas_accreditation       text not null default 'None', -- None | Basic Fatigue | Mass Management | Maintenance Management
  nhvas_number              text not null default '',
  public_liability_policy   text not null default '',
  public_liability_expiry   date,
  public_liability_file_url text,
  workers_comp_policy       text not null default '',
  workers_comp_expiry       date,
  workers_comp_file_url     text,
  primary_depot             text not null default '',
  status                    text not null default 'Pending Review', -- Compliant | Pending Review | Suspended
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- RLS: drivers manage their own contractor profile; admins see and manage all
alter table public.contractor_profiles enable row level security;

drop policy if exists "contractor_profiles_select" on public.contractor_profiles;
create policy "contractor_profiles_select"
  on public.contractor_profiles for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "contractor_profiles_driver_manage" on public.contractor_profiles;
create policy "contractor_profiles_driver_manage"
  on public.contractor_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "contractor_profiles_admin_manage" on public.contractor_profiles;
create policy "contractor_profiles_admin_manage"
  on public.contractor_profiles for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Storage RLS: drivers upload and manage their own contractor documents
-- (files are stored under <user_id>/<file>), admins manage all
drop policy if exists "contractor_documents_select" on storage.objects;
create policy "contractor_documents_select"
  on storage.objects for select
  using (
    bucket_id = 'contractor-documents'
    and (
      public.is_admin(auth.uid())
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists "contractor_documents_insert" on storage.objects;
create policy "contractor_documents_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'contractor-documents'
    and (
      public.is_admin(auth.uid())
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists "contractor_documents_update" on storage.objects;
create policy "contractor_documents_update"
  on storage.objects for update
  using (
    bucket_id = 'contractor-documents'
    and (
      public.is_admin(auth.uid())
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  )
  with check (
    bucket_id = 'contractor-documents'
    and (
      public.is_admin(auth.uid())
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists "contractor_documents_delete" on storage.objects;
create policy "contractor_documents_delete"
  on storage.objects for delete
  using (
    bucket_id = 'contractor-documents'
    and (
      public.is_admin(auth.uid())
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
