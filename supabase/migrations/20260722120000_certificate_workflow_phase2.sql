-- Certificates + Portal Release Workflow — Phase 2
--
-- Adds:
--   1. `certificate_attachments` — first-class table for uploaded calibration
--      PDFs and supplementary cert documents linked to a work order (and
--      optionally a calibration_record). Reuses the existing
--      `work-order-attachments` storage bucket (path: {org}/{wo}/cert-...) so
--      no new storage policies are required for cert attachments.
--   2. `technicians.signature_url` + `technicians.signature_updated_at` —
--      stored as the storage path inside the new `equipify-signatures` bucket.
--   3. New private bucket `equipify-signatures` with RLS-equivalent storage
--      policies — read for any org member, write for org managers.
--
-- All changes are additive and non-destructive. Existing certificate output
-- (generated PDF/HTML) is unchanged when no signature/attachment is present.

do $$
begin
  if to_regprocedure('public.is_org_member(uuid)') is null then
    raise exception 'Missing dependency: public.is_org_member(uuid)';
  end if;
  if to_regprocedure('public.has_org_role(uuid,text[])') is null then
    raise exception 'Missing dependency: public.has_org_role(uuid,text[])';
  end if;
end;
$$;

-- ─── 1. certificate_attachments ──────────────────────────────────────────────

create table if not exists public.certificate_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  -- Optional asset scope: when set, the attachment is shown on the equipment
  -- card inside the Work Order Certificates tab.
  equipment_id uuid references public.equipment (id) on delete set null,
  -- Optional link to a saved calibration record. When set, the attachment
  -- is treated as an external scan/PDF for that specific certificate.
  calibration_record_id uuid references public.calibration_records (id) on delete set null,
  category text not null
    check (category in ('external_calibration', 'supplementary')),
  file_name text not null,
  file_type text not null,
  storage_path text not null,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  notes text,
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create unique index if not exists idx_certificate_attachments_storage_path
  on public.certificate_attachments (storage_path);

create index if not exists idx_certificate_attachments_org_wo
  on public.certificate_attachments (organization_id, work_order_id, uploaded_at);

create index if not exists idx_certificate_attachments_org_record
  on public.certificate_attachments (organization_id, calibration_record_id)
  where calibration_record_id is not null;

create index if not exists idx_certificate_attachments_org_equipment
  on public.certificate_attachments (organization_id, equipment_id)
  where equipment_id is not null;

comment on table public.certificate_attachments is
  'Phase 2: uploaded PDFs / supplementary certificate documents. Reuses work-order-attachments storage bucket (path scheme {org}/{wo}/cert-...).';

revoke all on table public.certificate_attachments from public, anon;
grant select, insert, update, delete on table public.certificate_attachments to authenticated;

alter table public.certificate_attachments enable row level security;
alter table public.certificate_attachments force row level security;

drop policy if exists "certificate_attachments_select_member" on public.certificate_attachments;
create policy "certificate_attachments_select_member"
on public.certificate_attachments for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "certificate_attachments_write_roles" on public.certificate_attachments;
create policy "certificate_attachments_write_roles"
on public.certificate_attachments for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

-- ─── 2. technicians.signature_url ────────────────────────────────────────────

alter table public.technicians
  add column if not exists signature_url text,
  add column if not exists signature_updated_at timestamptz;

comment on column public.technicians.signature_url is
  'Storage path inside `equipify-signatures` bucket. When set, certificate output uses this image as the technician signature when no fresh signature was captured for the visit.';
comment on column public.technicians.signature_updated_at is
  'When the stored technician signature was last uploaded/replaced.';

create index if not exists idx_technicians_org_has_signature
  on public.technicians (organization_id)
  where signature_url is not null;

-- ─── 3. equipify-signatures storage bucket ───────────────────────────────────
-- Private bucket used for stored technician signatures. Path scheme:
--   {organization_id}/technicians/{technician_id}/signature-{uuid}.png

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'equipify-signatures',
  'equipify-signatures',
  false,
  2097152, -- 2 MiB max — signatures are tiny PNGs/JPEGs
  array[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "equipify_signatures_select_member" on storage.objects;
create policy "equipify_signatures_select_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'equipify-signatures'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.is_org_member(split_part(name, '/', 1)::uuid)
);

drop policy if exists "equipify_signatures_insert_roles" on storage.objects;
create policy "equipify_signatures_insert_roles"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'equipify-signatures'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner', 'admin', 'manager'])
);

drop policy if exists "equipify_signatures_update_roles" on storage.objects;
create policy "equipify_signatures_update_roles"
on storage.objects for update to authenticated
using (
  bucket_id = 'equipify-signatures'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner', 'admin', 'manager'])
)
with check (
  bucket_id = 'equipify-signatures'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner', 'admin', 'manager'])
);

drop policy if exists "equipify_signatures_delete_roles" on storage.objects;
create policy "equipify_signatures_delete_roles"
on storage.objects for delete to authenticated
using (
  bucket_id = 'equipify-signatures'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner', 'admin', 'manager'])
);
