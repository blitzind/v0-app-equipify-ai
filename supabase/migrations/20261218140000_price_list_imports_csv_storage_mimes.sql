-- Allow CSV MIME types on price-list-imports storage bucket (PDF-only bucket blocked text/csv uploads).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'price-list-imports',
  'price-list-imports',
  false,
  52428800,
  array[
    'application/pdf',
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'text/comma-separated-values',
    'text/plain',
    'application/octet-stream'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
