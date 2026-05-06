-- Catalog as reusable item library: compatibility, pricing metadata, attachments, usage linkage.

-- ─── item_type: labor + kit ───────────────────────────────────────────────────
alter table public.catalog_items drop constraint if exists catalog_items_item_type_check;
alter table public.catalog_items
  add constraint catalog_items_item_type_check
  check (
    item_type in (
      'equipment',
      'part',
      'accessory',
      'service',
      'labor',
      'rental',
      'option',
      'kit',
      'other'
    )
  );

-- ─── Core catalog fields ──────────────────────────────────────────────────────
alter table public.catalog_items
  add column if not exists taxable boolean not null default true,
  add column if not exists discontinued_replacement_notes text,
  add column if not exists price_source text,
  add column if not exists compatibility jsonb not null default '{}'::jsonb,
  add column if not exists archived_at timestamptz;

comment on column public.catalog_items.taxable is 'Whether this catalog line is taxed when added to quotes/invoices.';
comment on column public.catalog_items.discontinued_replacement_notes is 'Notes when a replacement SKU supersedes this item.';
comment on column public.catalog_items.price_source is 'Human-readable origin of pricing (e.g. import label, manual entry).';
comment on column public.catalog_items.compatibility is 'JSON: equipment_models[], manufacturers[], related_catalog_item_ids[].';
comment on column public.catalog_items.archived_at is 'Soft-archive catalog template; hidden from default lists.';

create index if not exists idx_catalog_items_org_archived
  on public.catalog_items (organization_id, archived_at);

-- ─── Work order parts ↔ catalog (optional FK for usage tracking) ──────────────
alter table public.work_order_line_items
  add column if not exists catalog_item_id uuid references public.catalog_items (id) on delete set null;

create index if not exists idx_work_order_line_items_catalog
  on public.work_order_line_items (organization_id, catalog_item_id)
  where catalog_item_id is not null;

-- ─── Catalog attachments (manuals, price sheets, etc.) ───────────────────────
create table if not exists public.catalog_item_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items (id) on delete cascade,
  file_name text not null,
  file_type text not null,
  storage_path text not null,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  category text not null default 'other'
    check (category in ('price_sheet', 'manual', 'spec_sheet', 'warranty', 'manufacturer_doc', 'other')),
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now()
);

comment on table public.catalog_item_attachments is 'Files linked to reusable catalog items (not customer equipment records).';

create unique index if not exists idx_catalog_item_attachments_storage_path
  on public.catalog_item_attachments (storage_path);

create index if not exists idx_catalog_item_attachments_org_item
  on public.catalog_item_attachments (organization_id, catalog_item_id, uploaded_at desc);

revoke all on table public.catalog_item_attachments from public, anon;
grant select, insert, update, delete on table public.catalog_item_attachments to authenticated;

alter table public.catalog_item_attachments enable row level security;
alter table public.catalog_item_attachments force row level security;

drop policy if exists "catalog_item_attachments_select_member" on public.catalog_item_attachments;
create policy "catalog_item_attachments_select_member"
on public.catalog_item_attachments for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "catalog_item_attachments_write_roles" on public.catalog_item_attachments;
create policy "catalog_item_attachments_write_roles"
on public.catalog_item_attachments for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-item-files',
  'catalog-item-files',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path: {organization_id}/{catalog_item_id}/{uuid}-{filename}

drop policy if exists "catalog_item_files_select_member" on storage.objects;
create policy "catalog_item_files_select_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'catalog-item-files'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.is_org_member(split_part(name, '/', 1)::uuid)
);

drop policy if exists "catalog_item_files_insert_roles" on storage.objects;
create policy "catalog_item_files_insert_roles"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'catalog-item-files'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and split_part(name, '/', 2) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner', 'admin', 'manager'])
);

drop policy if exists "catalog_item_files_update_roles" on storage.objects;
create policy "catalog_item_files_update_roles"
on storage.objects for update to authenticated
using (
  bucket_id = 'catalog-item-files'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner', 'admin', 'manager'])
);

drop policy if exists "catalog_item_files_delete_roles" on storage.objects;
create policy "catalog_item_files_delete_roles"
on storage.objects for delete to authenticated
using (
  bucket_id = 'catalog-item-files'
  and split_part(name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
  and public.has_org_role(split_part(name, '/', 1)::uuid, array['owner', 'admin', 'manager'])
);
