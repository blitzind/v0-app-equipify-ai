-- Growth Engine B3 — Extend growth-videos bucket for thumbnail/OG image uploads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'growth-videos',
  'growth-videos',
  false,
  262144000,
  array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  allowed_mime_types = excluded.allowed_mime_types;
