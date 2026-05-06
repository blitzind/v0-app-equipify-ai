-- QuickBooks Online integration foundation: connection metadata, OAuth secrets (service-role only),
-- sync logs, and external ID mappings.

-- -----------------------------------------------------------------------------
-- organization_integrations — non-secret connection metadata per org + provider
-- -----------------------------------------------------------------------------

create table if not exists public.organization_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider = 'quickbooks_online'),
  connection_status text not null default 'disconnected'
    check (connection_status in ('disconnected', 'connected', 'error', 'revoked')),
  realm_id text,
  company_name text,
  connected_by_user_id uuid references auth.users (id) on delete set null,
  last_successful_sync_at timestamptz,
  last_sync_attempt_at timestamptz,
  sync_health text not null default 'unknown'
    check (sync_health in ('unknown', 'healthy', 'degraded', 'error')),
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_integrations_org_provider_unique unique (organization_id, provider)
);

create index if not exists idx_organization_integrations_org
  on public.organization_integrations (organization_id);

comment on table public.organization_integrations is
  'Third-party integration connections (tokens stored in organization_integration_oauth_tokens).';

-- -----------------------------------------------------------------------------
-- organization_integration_oauth_tokens — secrets; NOT exposed to authenticated role
-- -----------------------------------------------------------------------------

create table if not exists public.organization_integration_oauth_tokens (
  organization_integration_id uuid primary key
    references public.organization_integrations (id) on delete cascade,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.organization_integration_oauth_tokens is
  'OAuth tokens for integrations — readable only via service role / server-side API.';

revoke all on table public.organization_integration_oauth_tokens from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- quickbooks_sync_logs — append-only style operational log (API writes via service role)
-- -----------------------------------------------------------------------------

create table if not exists public.quickbooks_sync_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sync_kind text not null
    check (
      sync_kind in (
        'customers',
        'invoices',
        'payments',
        'catalog_items',
        'full_initial'
      )
    ),
  direction text not null default 'export'
    check (direction in ('export', 'import', 'bidirectional')),
  status text not null
    check (status in ('started', 'success', 'partial', 'failed')),
  records_attempted integer not null default 0,
  records_succeeded integer not null default 0,
  error_message text,
  detail jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_quickbooks_sync_logs_org_started
  on public.quickbooks_sync_logs (organization_id, started_at desc);

comment on table public.quickbooks_sync_logs is
  'QuickBooks sync runs — status, counts, and errors for observability.';

-- -----------------------------------------------------------------------------
-- external_sync_mappings — Equipify entity ↔ QuickBooks entity IDs
-- -----------------------------------------------------------------------------

create table if not exists public.external_sync_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null default 'quickbooks_online'
    check (provider = 'quickbooks_online'),
  entity_type text not null
    check (entity_type in ('customer', 'invoice', 'payment', 'catalog_item')),
  internal_id uuid not null,
  external_id text not null check (char_length(trim(external_id)) > 0),
  sync_status text not null default 'pending'
    check (sync_status in ('pending', 'synced', 'error', 'stale')),
  last_synced_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  constraint external_sync_mappings_unique_entity unique (organization_id, provider, entity_type, internal_id)
);

create index if not exists idx_external_sync_mappings_org_type
  on public.external_sync_mappings (organization_id, entity_type);

create index if not exists idx_external_sync_mappings_external
  on public.external_sync_mappings (organization_id, provider, external_id);

comment on table public.external_sync_mappings is
  'Maps internal Equipify rows to QuickBooks IDs with last sync metadata.';

-- -----------------------------------------------------------------------------
-- RLS — integrations + logs + mappings (members read; managers write)
-- OAuth token table: no authenticated access
-- -----------------------------------------------------------------------------

alter table public.organization_integrations enable row level security;
alter table public.organization_integrations force row level security;
alter table public.quickbooks_sync_logs enable row level security;
alter table public.quickbooks_sync_logs force row level security;
alter table public.external_sync_mappings enable row level security;
alter table public.external_sync_mappings force row level security;

alter table public.organization_integration_oauth_tokens enable row level security;
alter table public.organization_integration_oauth_tokens force row level security;

revoke all on table public.organization_integrations from public, anon;
revoke all on table public.quickbooks_sync_logs from public, anon;
revoke all on table public.external_sync_mappings from public, anon;

grant select, insert, update, delete on table public.organization_integrations to authenticated;
grant select, insert, update, delete on table public.quickbooks_sync_logs to authenticated;
grant select, insert, update, delete on table public.external_sync_mappings to authenticated;

drop policy if exists "organization_integrations_select_member" on public.organization_integrations;
create policy "organization_integrations_select_member"
on public.organization_integrations for select to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "organization_integrations_write_roles" on public.organization_integrations;
create policy "organization_integrations_write_roles"
on public.organization_integrations for all to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "quickbooks_sync_logs_select_member" on public.quickbooks_sync_logs;
create policy "quickbooks_sync_logs_select_member"
on public.quickbooks_sync_logs for select to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "quickbooks_sync_logs_insert_roles" on public.quickbooks_sync_logs;
create policy "quickbooks_sync_logs_insert_roles"
on public.quickbooks_sync_logs for insert to authenticated
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "quickbooks_sync_logs_update_roles" on public.quickbooks_sync_logs;
create policy "quickbooks_sync_logs_update_roles"
on public.quickbooks_sync_logs for update to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "quickbooks_sync_logs_delete_roles" on public.quickbooks_sync_logs;
create policy "quickbooks_sync_logs_delete_roles"
on public.quickbooks_sync_logs for delete to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "external_sync_mappings_select_member" on public.external_sync_mappings;
create policy "external_sync_mappings_select_member"
on public.external_sync_mappings for select to authenticated
using (public.is_org_member (organization_id));

drop policy if exists "external_sync_mappings_write_roles" on public.external_sync_mappings;
create policy "external_sync_mappings_write_roles"
on public.external_sync_mappings for all to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']))
with check (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

-- Deny all authenticated access to OAuth secrets (service role bypasses RLS).
drop policy if exists "oauth_tokens_deny_all" on public.organization_integration_oauth_tokens;
create policy "oauth_tokens_deny_all"
on public.organization_integration_oauth_tokens for all to authenticated
using (false)
with check (false);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_organization_integrations_set_updated_at on public.organization_integrations;
    create trigger trg_organization_integrations_set_updated_at
    before update on public.organization_integrations
    for each row execute function public.set_updated_at();
  end if;
end;
$$;
