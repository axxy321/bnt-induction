-- Allow admins to upload driver learning module videos to the existing public
-- induction-assets bucket. Keep all current bucket MIME types and add common
-- browser-playable video formats.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'induction-assets',
  'induction-assets',
  true,
  104857600,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
    'video/mp4', 'video/webm', 'video/ogg'
  ]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
    'video/mp4', 'video/webm', 'video/ogg'
  ];
