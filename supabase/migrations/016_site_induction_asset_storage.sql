-- Published induction slides use stable public URLs so drivers can open media
-- after the admin session that uploaded it has ended.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'induction-assets',
  'induction-assets',
  true,
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "induction_assets_admin_insert" on storage.objects;
create policy "induction_assets_admin_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'induction-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_admin(auth.uid())
  );

drop policy if exists "induction_assets_admin_update" on storage.objects;
create policy "induction_assets_admin_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'induction-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_admin(auth.uid())
  )
  with check (
    bucket_id = 'induction-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_admin(auth.uid())
  );

drop policy if exists "induction_assets_admin_delete" on storage.objects;
create policy "induction_assets_admin_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'induction-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_admin(auth.uid())
  );
