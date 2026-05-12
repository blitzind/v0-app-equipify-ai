-- BlitzPay Phase 5A — Multi-entity / franchise financial foundations (orchestration & reporting only; no cross-org DB merge; no autonomous settlements).
-- RLS: finance roles; visibility via explicit group anchor or active membership; no customer portal.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('public.organization_members') is null then
    raise exception 'Missing dependency: public.organization_members';
  end if;
  if to_regprocedure('public.has_org_role(uuid, text[])') is null then
    raise exception 'Missing dependency: public.has_org_role(uuid, text[])';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Financial groups (anchor org owns the group record)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_financial_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  group_name text not null,
  group_type text not null
    check (group_type in ('franchise', 'holding_company', 'regional_operator', 'enterprise', 'custom')),
  group_status text not null default 'active'
    check (group_status in ('active', 'inactive', 'archived')),
  parent_group_id uuid references public.blitzpay_financial_groups (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_financial_groups is
  'Multi-entity financial group; anchor organization_id owns configuration; no automatic cross-org control.';

create index if not exists idx_blitzpay_fin_groups_org_status
  on public.blitzpay_financial_groups (organization_id, group_status);

create index if not exists idx_blitzpay_fin_groups_parent
  on public.blitzpay_financial_groups (parent_group_id);

-- ---------------------------------------------------------------------------
-- Group membership (explicit linkage; one row per org per group)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_financial_group_members (
  id uuid primary key default gen_random_uuid(),
  financial_group_id uuid not null references public.blitzpay_financial_groups (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  membership_role text not null
    check (membership_role in ('parent', 'child', 'regional', 'observer')),
  member_status text not null default 'active'
    check (member_status in ('active', 'suspended', 'removed')),
  joined_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_fin_group_member_unique unique (financial_group_id, organization_id)
);

comment on table public.blitzpay_financial_group_members is
  'Explicit org-to-group linkage; visibility derives from membership plus finance role on member org.';

create index if not exists idx_blitzpay_fin_group_members_org
  on public.blitzpay_financial_group_members (organization_id, member_status);

create index if not exists idx_blitzpay_fin_group_members_group
  on public.blitzpay_financial_group_members (financial_group_id, member_status);

-- ---------------------------------------------------------------------------
-- Inter-company balances (tracking only; no autonomous settlement)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_intercompany_balances (
  id uuid primary key default gen_random_uuid(),
  financial_group_id uuid not null references public.blitzpay_financial_groups (id) on delete cascade,
  source_organization_id uuid not null references public.organizations (id) on delete cascade,
  target_organization_id uuid not null references public.organizations (id) on delete cascade,
  balance_type text not null
    check (balance_type in ('payable', 'receivable', 'allocation', 'reimbursement', 'payroll_share', 'treasury_share')),
  balance_status text not null default 'active'
    check (balance_status in ('active', 'settled', 'disputed', 'archived')),
  balance_amount_cents bigint not null default 0 check (balance_amount_cents >= 0),
  originating_entry_reference text,
  settlement_due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_ic_balance_distinct_orgs check (source_organization_id <> target_organization_id)
);

comment on table public.blitzpay_intercompany_balances is
  'Inter-company balance tracking rows; reporting only in Phase 5A — no GL auto-posting.';

create index if not exists idx_blitzpay_ic_balances_group_status
  on public.blitzpay_intercompany_balances (financial_group_id, balance_status, created_at desc);

-- ---------------------------------------------------------------------------
-- Consolidated KPI snapshots (reporting aggregates; not authoritative GL)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_consolidated_snapshots (
  id uuid primary key default gen_random_uuid(),
  financial_group_id uuid not null references public.blitzpay_financial_groups (id) on delete cascade,
  snapshot_date date not null,
  total_revenue_cents bigint not null default 0 check (total_revenue_cents >= 0),
  total_collections_cents bigint not null default 0 check (total_collections_cents >= 0),
  total_payables_cents bigint not null default 0 check (total_payables_cents >= 0),
  total_payroll_cents bigint not null default 0 check (total_payroll_cents >= 0),
  total_inventory_value_cents bigint not null default 0 check (total_inventory_value_cents >= 0),
  total_financing_exposure_cents bigint not null default 0 check (total_financing_exposure_cents >= 0),
  total_treasury_exposure_cents bigint not null default 0 check (total_treasury_exposure_cents >= 0),
  organization_count integer not null default 0 check (organization_count >= 0),
  consolidated_health_score integer
    check (consolidated_health_score is null or (consolidated_health_score >= 0 and consolidated_health_score <= 100)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint blitzpay_consolidated_snapshot_unique unique (financial_group_id, snapshot_date)
);

comment on table public.blitzpay_consolidated_snapshots is
  'Deterministic consolidated reporting snapshot per group per day; not GL consolidation.';

create index if not exists idx_blitzpay_consolidated_group_date
  on public.blitzpay_consolidated_snapshots (financial_group_id, snapshot_date desc);

-- ---------------------------------------------------------------------------
-- Multi-entity audit log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_multi_entity_audit_log (
  id uuid primary key default gen_random_uuid(),
  financial_group_id uuid references public.blitzpay_financial_groups (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  audit_type text not null
    check (audit_type in (
      'group_created', 'org_linked', 'org_removed', 'rollup_generated', 'intercompany_balance_created',
      'intercompany_balance_settled', 'permissions_changed', 'manual_override'
    )),
  actor_type text not null default 'system'
    check (actor_type in ('system', 'admin', 'user')),
  actor_id uuid,
  audit_summary text not null,
  immutable_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.blitzpay_multi_entity_audit_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'blitzpay_multi_entity_audit_immutable';
end;
$$;

drop trigger if exists trg_blitzpay_multi_entity_audit_block_update on public.blitzpay_multi_entity_audit_log;
create trigger trg_blitzpay_multi_entity_audit_block_update
before update on public.blitzpay_multi_entity_audit_log
for each row execute function public.blitzpay_multi_entity_audit_block_mutation();

drop trigger if exists trg_blitzpay_multi_entity_audit_block_delete on public.blitzpay_multi_entity_audit_log;
create trigger trg_blitzpay_multi_entity_audit_block_delete
before delete on public.blitzpay_multi_entity_audit_log
for each row execute function public.blitzpay_multi_entity_audit_block_mutation();

create index if not exists idx_blitzpay_multi_entity_audit_group_created
  on public.blitzpay_multi_entity_audit_log (financial_group_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Shared operational benchmarks (aggregate metrics only; no customer PII)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_shared_operational_benchmarks (
  id uuid primary key default gen_random_uuid(),
  financial_group_id uuid not null references public.blitzpay_financial_groups (id) on delete cascade,
  benchmark_type text not null
    check (benchmark_type in (
      'collections', 'payroll', 'memberships', 'financing', 'procurement', 'inventory', 'treasury', 'revenue'
    )),
  benchmark_period text not null
    check (benchmark_period in ('weekly', 'monthly', 'quarterly', 'yearly')),
  benchmark_score integer
    check (benchmark_score is null or (benchmark_score >= 0 and benchmark_score <= 100)),
  benchmark_summary text,
  supporting_metrics jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_shared_benchmarks_group_type
  on public.blitzpay_shared_operational_benchmarks (financial_group_id, benchmark_type, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_blitzpay_fin_groups_updated on public.blitzpay_financial_groups;
create trigger trg_blitzpay_fin_groups_updated
before update on public.blitzpay_financial_groups
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_fin_group_members_updated on public.blitzpay_financial_group_members;
create trigger trg_blitzpay_fin_group_members_updated
before update on public.blitzpay_financial_group_members
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_ic_balances_updated on public.blitzpay_intercompany_balances;
create trigger trg_blitzpay_ic_balances_updated
before update on public.blitzpay_intercompany_balances
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_financial_groups from public, anon;
revoke all on table public.blitzpay_financial_group_members from public, anon;
revoke all on table public.blitzpay_intercompany_balances from public, anon;
revoke all on table public.blitzpay_consolidated_snapshots from public, anon;
revoke all on table public.blitzpay_multi_entity_audit_log from public, anon;
revoke all on table public.blitzpay_shared_operational_benchmarks from public, anon;

grant select on table public.blitzpay_financial_groups to authenticated;
grant select on table public.blitzpay_financial_group_members to authenticated;
grant select on table public.blitzpay_intercompany_balances to authenticated;
grant select on table public.blitzpay_consolidated_snapshots to authenticated;
grant select on table public.blitzpay_multi_entity_audit_log to authenticated;
grant select on table public.blitzpay_shared_operational_benchmarks to authenticated;

alter table public.blitzpay_financial_groups enable row level security;
alter table public.blitzpay_financial_groups force row level security;
alter table public.blitzpay_financial_group_members enable row level security;
alter table public.blitzpay_financial_group_members force row level security;
alter table public.blitzpay_intercompany_balances enable row level security;
alter table public.blitzpay_intercompany_balances force row level security;
alter table public.blitzpay_consolidated_snapshots enable row level security;
alter table public.blitzpay_consolidated_snapshots force row level security;
alter table public.blitzpay_multi_entity_audit_log enable row level security;
alter table public.blitzpay_multi_entity_audit_log force row level security;
alter table public.blitzpay_shared_operational_benchmarks enable row level security;
alter table public.blitzpay_shared_operational_benchmarks force row level security;

-- Groups: anchor org finance role OR active member with finance role on member org.
drop policy if exists "blitzpay_fin_groups_select_finance" on public.blitzpay_financial_groups;
create policy "blitzpay_fin_groups_select_finance"
on public.blitzpay_financial_groups
for select
to authenticated
using (
  public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[])
  or exists (
    select 1
    from public.blitzpay_financial_group_members m
    inner join public.organization_members om
      on om.organization_id = m.organization_id
     and om.user_id = (select auth.uid())
     and om.status = 'active'
    where m.financial_group_id = blitzpay_financial_groups.id
      and m.member_status = 'active'
      and public.has_org_role (m.organization_id, array['owner', 'admin', 'manager']::text[])
  )
);

drop policy if exists "blitzpay_fin_group_members_select_finance" on public.blitzpay_financial_group_members;
create policy "blitzpay_fin_group_members_select_finance"
on public.blitzpay_financial_group_members
for select
to authenticated
using (
  public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[])
  or exists (
    select 1
    from public.blitzpay_financial_groups g
    where g.id = blitzpay_financial_group_members.financial_group_id
      and public.has_org_role (g.organization_id, array['owner', 'admin', 'manager']::text[])
  )
);

drop policy if exists "blitzpay_ic_balances_select_finance" on public.blitzpay_intercompany_balances;
create policy "blitzpay_ic_balances_select_finance"
on public.blitzpay_intercompany_balances
for select
to authenticated
using (
  exists (
    select 1
    from public.blitzpay_financial_groups g
    where g.id = blitzpay_intercompany_balances.financial_group_id
      and (
        public.has_org_role (g.organization_id, array['owner', 'admin', 'manager']::text[])
        or exists (
          select 1
          from public.blitzpay_financial_group_members m
          inner join public.organization_members om
            on om.organization_id = m.organization_id
           and om.user_id = (select auth.uid())
           and om.status = 'active'
          where m.financial_group_id = g.id
            and m.member_status = 'active'
            and public.has_org_role (m.organization_id, array['owner', 'admin', 'manager']::text[])
        )
      )
  )
);

drop policy if exists "blitzpay_consolidated_snapshots_select_finance" on public.blitzpay_consolidated_snapshots;
create policy "blitzpay_consolidated_snapshots_select_finance"
on public.blitzpay_consolidated_snapshots
for select
to authenticated
using (
  exists (
    select 1
    from public.blitzpay_financial_groups g
    where g.id = blitzpay_consolidated_snapshots.financial_group_id
      and (
        public.has_org_role (g.organization_id, array['owner', 'admin', 'manager']::text[])
        or exists (
          select 1
          from public.blitzpay_financial_group_members m
          inner join public.organization_members om
            on om.organization_id = m.organization_id
           and om.user_id = (select auth.uid())
           and om.status = 'active'
          where m.financial_group_id = g.id
            and m.member_status = 'active'
            and public.has_org_role (m.organization_id, array['owner', 'admin', 'manager']::text[])
        )
      )
  )
);

drop policy if exists "blitzpay_multi_entity_audit_select_finance" on public.blitzpay_multi_entity_audit_log;
create policy "blitzpay_multi_entity_audit_select_finance"
on public.blitzpay_multi_entity_audit_log
for select
to authenticated
using (
  (
    blitzpay_multi_entity_audit_log.financial_group_id is null
    and blitzpay_multi_entity_audit_log.organization_id is not null
    and public.has_org_role (blitzpay_multi_entity_audit_log.organization_id, array['owner', 'admin', 'manager']::text[])
  )
  or exists (
    select 1
    from public.blitzpay_financial_groups g
    where g.id = blitzpay_multi_entity_audit_log.financial_group_id
      and (
        public.has_org_role (g.organization_id, array['owner', 'admin', 'manager']::text[])
        or exists (
          select 1
          from public.blitzpay_financial_group_members m
          inner join public.organization_members om
            on om.organization_id = m.organization_id
           and om.user_id = (select auth.uid())
           and om.status = 'active'
          where m.financial_group_id = g.id
            and m.member_status = 'active'
            and public.has_org_role (m.organization_id, array['owner', 'admin', 'manager']::text[])
        )
      )
  )
);

drop policy if exists "blitzpay_shared_benchmarks_select_finance" on public.blitzpay_shared_operational_benchmarks;
create policy "blitzpay_shared_benchmarks_select_finance"
on public.blitzpay_shared_operational_benchmarks
for select
to authenticated
using (
  exists (
    select 1
    from public.blitzpay_financial_groups g
    where g.id = blitzpay_shared_operational_benchmarks.financial_group_id
      and (
        public.has_org_role (g.organization_id, array['owner', 'admin', 'manager']::text[])
        or exists (
          select 1
          from public.blitzpay_financial_group_members m
          inner join public.organization_members om
            on om.organization_id = m.organization_id
           and om.user_id = (select auth.uid())
           and om.status = 'active'
          where m.financial_group_id = g.id
            and m.member_status = 'active'
            and public.has_org_role (m.organization_id, array['owner', 'admin', 'manager']::text[])
        )
      )
  )
);
