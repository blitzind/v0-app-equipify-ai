-- Catalog items + manufacturer price list imports (MVP foundation).

create table if not exists public.price_list_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  uploaded_by uuid not null,
  vendor_id uuid references public.org_vendors (id) on delete set null,
  manufacturer_name text,
  file_name text not null default '',
  file_url text,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'needs_review', 'approved', 'failed')),
  extracted_json jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.price_list_imports is 'Uploaded manufacturer/vendor price lists pending AI extraction and catalog commit.';

create index if not exists idx_price_list_imports_org_created
  on public.price_list_imports (organization_id, created_at desc);

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vendor_id uuid references public.org_vendors (id) on delete set null,
  manufacturer_name text,
  source_file_name text not null default '',
  source_file_url text,
  source_import_id uuid references public.price_list_imports (id) on delete set null,
  category text not null default '',
  item_type text not null default 'other'
    check (item_type in ('equipment', 'part', 'accessory', 'service', 'rental', 'option', 'other')),
  part_number text not null default '',
  sku text,
  name text not null default '',
  description text,
  list_price numeric(14, 4),
  cost numeric(14, 4),
  sale_price numeric(14, 4),
  margin_percent numeric(8, 4),
  unit text not null default 'ea',
  status text not null default 'active'
    check (status in ('active', 'inactive', 'discontinued', 'needs_review')),
  replacement_part_number text,
  effective_date date,
  notes text,
  raw_extracted_text text,
  confidence_score numeric(6, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.catalog_items is 'Org-scoped reusable catalog lines (quotes, invoices, WOs, POs — integration later).';

create index if not exists idx_catalog_items_org_created
  on public.catalog_items (organization_id, created_at desc);

create index if not exists idx_catalog_items_org_vendor
  on public.catalog_items (organization_id, vendor_id);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_price_list_imports_set_updated_at on public.price_list_imports;
    create trigger trg_price_list_imports_set_updated_at
    before update on public.price_list_imports
    for each row execute function public.set_updated_at();

    drop trigger if exists trg_catalog_items_set_updated_at on public.catalog_items;
    create trigger trg_catalog_items_set_updated_at
    before update on public.catalog_items
    for each row execute function public.set_updated_at();
  end if;
end
$$;

revoke all on table public.price_list_imports from public, anon;
grant select, insert, update, delete on table public.price_list_imports to authenticated;

revoke all on table public.catalog_items from public, anon;
grant select, insert, update, delete on table public.catalog_items to authenticated;

alter table public.price_list_imports enable row level security;
alter table public.price_list_imports force row level security;
alter table public.catalog_items enable row level security;
alter table public.catalog_items force row level security;

drop policy if exists "price_list_imports_select_member" on public.price_list_imports;
create policy "price_list_imports_select_member"
on public.price_list_imports for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "price_list_imports_write_roles" on public.price_list_imports;
create policy "price_list_imports_write_roles"
on public.price_list_imports for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "catalog_items_select_member" on public.catalog_items;
create policy "catalog_items_select_member"
on public.catalog_items for select to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "catalog_items_write_roles" on public.catalog_items;
create policy "catalog_items_write_roles"
on public.catalog_items for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role(organization_id, array['owner', 'admin', 'manager']));

-- Private bucket for uploaded price list PDFs (server uploads via service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'price-list-imports',
  'price-list-imports',
  false,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
