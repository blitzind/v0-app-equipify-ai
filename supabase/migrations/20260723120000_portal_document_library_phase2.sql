-- Customer Portal Document Access — Phase 2
--
-- Adds a workspace + customer-level toggle for *consolidated* portal
-- document visibility. When enabled, a portal user assigned to a parent
-- customer can see documents that belong to its descendants in the
-- customer hierarchy. Default is OFF everywhere — single-customer portal
-- behavior is preserved verbatim.
--
-- Strict rules:
--   - additive, idempotent, safe to re-run
--   - nullable everywhere; no backfill required
--   - reuses the customer-hierarchy parent_customer_id column shipped in
--     20260721120000_customer_hierarchy_phase1.sql
--   - does not touch RLS policies; portal endpoints continue to read via
--     service role with explicit organization_id + customer_id filters

-- ─── organizations: workspace default ────────────────────────────────────
alter table public.organizations
  add column if not exists portal_consolidated_documents_default boolean;

update public.organizations
set portal_consolidated_documents_default = coalesce(
  portal_consolidated_documents_default,
  false
);

alter table public.organizations
  alter column portal_consolidated_documents_default set default false;

comment on column public.organizations.portal_consolidated_documents_default is
  'Default for parent-account document rollup in the customer portal. When true, every customer in this org defaults to consolidated visibility unless an explicit per-customer override is set on customers.portal_consolidated_documents_enabled. Default false preserves single-customer behavior.';

-- ─── customers: per-customer override ────────────────────────────────────
-- null = inherit organizations.portal_consolidated_documents_default
-- true / false = explicit override
alter table public.customers
  add column if not exists portal_consolidated_documents_enabled boolean;

comment on column public.customers.portal_consolidated_documents_enabled is
  'Per-customer override for parent-account portal document rollup. NULL inherits the workspace default; TRUE/FALSE force the behavior for this customer specifically.';

-- ─── helpful index for scope resolution ──────────────────────────────────
-- BFS queries during portal scope resolution always filter by
-- organization_id + parent_customer_id, so a partial index keeps the walk
-- cheap. Phase 1 already provides idx_customers_org_parent; this guards
-- against environments that imported the table without that index.
create index if not exists idx_customers_org_parent_active
  on public.customers (organization_id, parent_customer_id)
  where archived_at is null;
