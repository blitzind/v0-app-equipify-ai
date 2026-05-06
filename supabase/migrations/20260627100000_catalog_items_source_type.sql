-- Distinguish catalog row origin: manual library entry vs import pipeline vs AI-only legacy.

alter table public.catalog_items
  add column if not exists source_type text not null default 'manual'
    check (source_type in ('manual', 'imported', 'ai_generated'));

comment on column public.catalog_items.source_type is
  'manual: created in-app; imported: committed from price list; ai_generated: AI-sourced without import link (legacy edge cases).';

update public.catalog_items
set source_type = case
  when source_import_id is not null then 'imported'
  when coalesce(ai_generated, false) = true then 'ai_generated'
  else 'manual'
end;

create index if not exists idx_catalog_items_org_source
  on public.catalog_items (organization_id, source_type);
