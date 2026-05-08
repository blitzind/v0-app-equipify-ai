-- Migration Center + FieldPulse — Phase 9 historical import mapping support.
--
-- FieldPulse migrations begin from exported CSV files. This extends the
-- existing external mapping table instead of creating a second mapping system.

alter table public.external_sync_mappings
  drop constraint if exists external_sync_mappings_provider_check;

alter table public.external_sync_mappings
  add constraint external_sync_mappings_provider_check
  check (provider in ('quickbooks_online', 'fieldpulse'));

alter table public.external_sync_mappings
  drop constraint if exists external_sync_mappings_entity_type_check;

alter table public.external_sync_mappings
  add constraint external_sync_mappings_entity_type_check
  check (
    entity_type in (
      'customer',
      'invoice',
      'payment',
      'catalog_item',
      'equipment',
      'work_order',
      'appointment'
    )
  );

comment on table public.external_sync_mappings is
  'Maps internal Equipify rows to external system IDs, including QuickBooks Online and FieldPulse historical imports.';
