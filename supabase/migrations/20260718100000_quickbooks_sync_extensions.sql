-- QuickBooks: integration toggles + mapping metadata for sync UI / staleness.

alter table public.organization_integrations
  add column if not exists sync_settings jsonb not null default '{"auto_sync_invoices": false}'::jsonb;

comment on column public.organization_integrations.sync_settings is
  'Org integration settings JSON (e.g. auto_sync_invoices for QuickBooks).';

alter table public.external_sync_mappings
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.external_sync_mappings.metadata is
  'Optional sync metadata (last source hash, QB SyncToken snapshot, etc.).';
