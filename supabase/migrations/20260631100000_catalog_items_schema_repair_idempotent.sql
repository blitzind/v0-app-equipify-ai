-- Idempotent repair for catalog_items schema drift (partial migrations, legacy DBs).
-- Additive only: no table drop/recreate; existing rows are preserved.

-- ─── Columns expected by Catalog UI + API (PostgREST select lists) ───────────
alter table public.catalog_items
  add column if not exists vendor_id uuid references public.org_vendors (id) on delete set null,
  add column if not exists manufacturer_name text,
  add column if not exists source_file_name text not null default '',
  add column if not exists source_file_url text,
  add column if not exists source_import_id uuid references public.price_list_imports (id) on delete set null,
  add column if not exists category text not null default '',
  add column if not exists item_type text not null default 'other',
  add column if not exists part_number text not null default '',
  add column if not exists sku text,
  add column if not exists name text not null default '',
  add column if not exists description text,
  add column if not exists list_price numeric(14, 4),
  add column if not exists cost numeric(14, 4),
  add column if not exists sale_price numeric(14, 4),
  add column if not exists margin_percent numeric(8, 4),
  add column if not exists unit text not null default 'ea',
  add column if not exists status text not null default 'active',
  add column if not exists replacement_part_number text,
  add column if not exists effective_date date,
  add column if not exists notes text,
  add column if not exists raw_extracted_text text,
  add column if not exists confidence_score numeric(6, 4),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists ai_generated boolean not null default false,
  add column if not exists ai_confidence numeric(6, 4),
  add column if not exists human_verified_at timestamptz,
  add column if not exists human_verified_by uuid references auth.users (id) on delete set null,
  add column if not exists taxable boolean not null default false,
  add column if not exists discontinued_replacement_notes text,
  add column if not exists price_source text,
  add column if not exists compatibility jsonb not null default '{}'::jsonb,
  add column if not exists archived_at timestamptz,
  add column if not exists source_type text not null default 'manual',
  add column if not exists is_sample boolean not null default false;

-- ─── Normalize before CHECK constraints ───────────────────────────────────────
update public.catalog_items
set status = 'active'
where status is null or trim(status) = '';

update public.catalog_items
set item_type = 'other'
where item_type is null
   or item_type not in (
     'equipment',
     'part',
     'accessory',
     'service',
     'labor',
     'rental',
     'option',
     'kit',
     'other'
   );

update public.catalog_items
set source_type = case
  when source_import_id is not null then 'imported'
  when coalesce(ai_generated, false) = true then 'ai_generated'
  when source_type in ('manual', 'imported', 'ai_generated') then source_type
  else 'manual'
end;

-- ─── Item types + source types used by forms and imports ─────────────────────
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

alter table public.catalog_items drop constraint if exists catalog_items_source_type_check;
alter table public.catalog_items
  add constraint catalog_items_source_type_check
  check (source_type in ('manual', 'imported', 'ai_generated'));

-- ─── Indexes (match prior migrations; safe when duplicate) ───────────────────
create index if not exists idx_catalog_items_org_created
  on public.catalog_items (organization_id, created_at desc);

create index if not exists idx_catalog_items_org_vendor
  on public.catalog_items (organization_id, vendor_id);

create index if not exists idx_catalog_items_org_archived
  on public.catalog_items (organization_id, archived_at);

create index if not exists idx_catalog_items_org_ai_verified
  on public.catalog_items (organization_id, ai_generated, human_verified_at);

create index if not exists idx_catalog_items_org_source
  on public.catalog_items (organization_id, source_type);

create index if not exists idx_catalog_items_org_sample
  on public.catalog_items (organization_id, is_sample)
  where is_sample = true;

comment on column public.catalog_items.taxable is 'Whether this catalog line is taxed when added to quotes/invoices.';
comment on column public.catalog_items.source_type is
  'manual: created in-app; imported: committed from price list; ai_generated: AI-sourced without import link (legacy edge cases).';
