-- ============================================================
-- Worksite Sign-In/Sign-Out Feature (Worksite tables)
-- ============================================================

-- 1. Worksites table
create table if not exists public.worksites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  site_code text not null unique,  -- Unique identifier for QR codes (e.g., 'PORT-MELBOURNE')
  qr_token text not null unique,    -- Unique token for QR codes (UUID without hyphens)
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for fast lookups
create index if not exists worksites_name_idx on public.worksites (name);
create index if not exists worksites_code_idx on public.worksites (site_code);
create index if not exists worksites_active_idx on public.worksites (is_active);

-- 2. Worksite attendance table to track driver sign-ins/outs
create table if not exists public.worksite_attendance (
  id uuid primary key default gen_random_uuid(),
  worksite_id uuid not null references public.worksites(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  driver_name text not null,  -- Denormalized for quick display
  signin_photo_url text not null,  -- URL to photo stored in storage.buckets.worksite-photos
  signin_at timestamptz not null default now(),
  signout_at timestamptz,
  signout_photo_url text,
  status text not null default 'signed_in' check (status in ('signed_in', 'signed_out')),
  duration_minutes int,  -- Calculated from signin_at and signout_at
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for fast lookups
create index if not exists worksite_attendance_user_idx on public.worksite_attendance (user_id);
create index if not exists worksite_attendance_worksite_idx on public.worksite_attendance (worksite_id);
create index if not exists worksite_attendance_status_idx on public.worksite_attendance (status);
create index if not exists worksite_attendance_signin_idx on public.worksite_attendance (signin_at);
create index if not exists worksite_attendance_signout_idx on public.worksite_attendance (signout_at);

-- 3. Create storage bucket for worksite photos (private)
-- This bucket will store driver photos taken during sign-in
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worksite-photos', 'worksite-photos', false, 10485760, array['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
on conflict (id) do update set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- 4. RLS policies for worksite-photos bucket
-- Select: admins and drivers (by foldername)
drop policy if exists "worksite_photos_select" on storage.objects;
create policy "worksite_photos_select"
   on storage.objects for select
   using (
     bucket_id = 'worksite-photos'
     and (
       public.is_admin(auth.uid())
       or (storage.foldername(name))[1] = auth.uid()::text
     )
   );

-- Insert: admins and drivers (by foldername)
drop policy if exists "worksite_photos_insert" on storage.objects;
create policy "worksite_photos_insert"
   on storage.objects for insert
   with check (
     bucket_id = 'worksite-photos'
     and (
       public.is_admin(auth.uid())
       or (storage.foldername(name))[1] = auth.uid()::text
     )
   );

-- Update: admins and drivers (by foldername)
drop policy if exists "worksite_photos_update" on storage.objects;
create policy "worksite_photos_update"
   on storage.objects for update
   using (
     bucket_id = 'worksite-photos'
     and (
       public.is_admin(auth.uid())
       or (storage.foldername(name))[1] = auth.uid()::text
     )
   )
   with check (
     bucket_id = 'worksite-photos'
     and (
       public.is_admin(auth.uid())
       or (storage.foldername(name))[1] = auth.uid()::text
     )
   );

-- Delete: admins and drivers (by foldername)
drop policy if exists "worksite_photos_delete" on storage.objects;
create policy "worksite_photos_delete"
   on storage.objects for delete
   using (
     bucket_id = 'worksite-photos'
     and (
       public.is_admin(auth.uid())
       or (storage.foldername(name))[1] = auth.uid()::text
     )
   );

-- 4. RLS policies for worksite_attendance table
-- Select: any authenticated user (drivers see their own, admins see all)
alter table public.worksite_attendance enable row level security;

drop policy if exists "worksite_attendance_select" on public.worksite_attendance;
create policy "worksite_attendance_select"
   on public.worksite_attendance for select
   using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "worksite_attendance_insert" on public.worksite_attendance;
create policy "worksite_attendance_insert"
   on public.worksite_attendance for insert
   with check (user_id = auth.uid());

-- Update: user_id = auth.uid() (driver signing in/out), admins can update others
drop policy if exists "worksite_attendance_update" on public.worksite_attendance;
create policy "worksite_attendance_update"
   on public.worksite_attendance for update
   using (user_id = auth.uid())
   with check (public.is_admin(auth.uid()));

-- Delete: user_id = auth.uid() (driver deleting own record), admins can delete others
drop policy if exists "worksite_attendance_delete" on public.worksite_attendance;
create policy "worksite_attendance_delete"
   on public.worksite_attendance for delete
   using (user_id = auth.uid() or public.is_admin(auth.uid()));