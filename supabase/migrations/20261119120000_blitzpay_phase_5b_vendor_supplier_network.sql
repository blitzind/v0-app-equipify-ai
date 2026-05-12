-- BlitzPay Phase 5B — Vendor / supplier network foundations (orchestration only; no autonomous procurement; no cross-org customer data).
-- RLS: finance roles + explicit network membership; aggregate benchmarks only.

do $$
begin
  if to_regclass('public.organizations') is null then
    raise exception 'Missing dependency: public.organizations';
  end if;
  if to_regclass('public.organization_members') is null then
    raise exception 'Missing dependency: public.organization_members';
  end if;
  if to_regclass('public.blitzpay_vendors') is null then
    raise exception 'Missing dependency: public.blitzpay_vendors (Phase 3B)';
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
-- Supplier networks (anchor org owns the network row)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_supplier_networks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  network_name text not null,
  network_type text not null
    check (network_type in (
      'procurement_group', 'supplier_coop', 'franchise_network', 'preferred_vendor_network', 'financing_network', 'custom'
    )),
  network_status text not null default 'active'
    check (network_status in ('active', 'inactive', 'archived')),
  visibility_scope text not null default 'private'
    check (visibility_scope in ('private', 'invited', 'shared')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blitzpay_supplier_networks is
  'Opt-in supplier/procurement network; anchor organization_id owns configuration; no automatic cross-org procurement.';

create index if not exists idx_blitzpay_supplier_networks_org_status
  on public.blitzpay_supplier_networks (organization_id, network_status);

-- ---------------------------------------------------------------------------
-- Network membership
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_supplier_network_members (
  id uuid primary key default gen_random_uuid(),
  supplier_network_id uuid not null references public.blitzpay_supplier_networks (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  membership_role text not null
    check (membership_role in ('owner', 'manager', 'participant', 'observer')),
  member_status text not null default 'active'
    check (member_status in ('active', 'suspended', 'removed')),
  joined_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_supplier_network_member_unique unique (supplier_network_id, organization_id)
);

comment on table public.blitzpay_supplier_network_members is
  'Explicit org participation in a supplier network; visibility derives from membership + finance role.';

create index if not exists idx_blitzpay_supplier_net_members_org
  on public.blitzpay_supplier_network_members (organization_id, member_status);

create index if not exists idx_blitzpay_supplier_net_members_net
  on public.blitzpay_supplier_network_members (supplier_network_id, member_status);

-- ---------------------------------------------------------------------------
-- Preferred vendor programs (informational; vendor belongs to an org)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_preferred_vendor_programs (
  id uuid primary key default gen_random_uuid(),
  supplier_network_id uuid references public.blitzpay_supplier_networks (id) on delete set null,
  vendor_id uuid not null references public.blitzpay_vendors (id) on delete cascade,
  program_name text not null,
  program_status text not null default 'active'
    check (program_status in ('active', 'inactive', 'expired', 'archived')),
  pricing_structure text not null
    check (pricing_structure in (
      'standard_discount', 'volume_discount', 'rebate', 'fixed_pricing', 'preferred_financing', 'custom'
    )),
  estimated_savings_basis_points integer
    check (estimated_savings_basis_points is null or (estimated_savings_basis_points >= 0 and estimated_savings_basis_points <= 10000)),
  minimum_volume_cents bigint check (minimum_volume_cents is null or minimum_volume_cents >= 0),
  effective_start_date date,
  effective_end_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_pref_vendor_programs_net
  on public.blitzpay_preferred_vendor_programs (supplier_network_id, program_status);

create index if not exists idx_blitzpay_pref_vendor_programs_vendor
  on public.blitzpay_preferred_vendor_programs (vendor_id, program_status);

-- ---------------------------------------------------------------------------
-- Bulk purchase opportunities (coordination visibility only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_bulk_purchase_opportunities (
  id uuid primary key default gen_random_uuid(),
  supplier_network_id uuid not null references public.blitzpay_supplier_networks (id) on delete cascade,
  opportunity_status text not null default 'active'
    check (opportunity_status in ('active', 'fulfilled', 'expired', 'archived')),
  opportunity_type text not null
    check (opportunity_type in ('inventory', 'equipment', 'materials', 'fleet', 'consumables', 'custom')),
  estimated_total_volume_cents bigint check (estimated_total_volume_cents is null or estimated_total_volume_cents >= 0),
  estimated_savings_cents bigint check (estimated_savings_cents is null or estimated_savings_cents >= 0),
  participating_organization_count integer check (participating_organization_count is null or participating_organization_count >= 0),
  expiration_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_bulk_purchase_net_status
  on public.blitzpay_bulk_purchase_opportunities (supplier_network_id, opportunity_status, created_at desc);

-- ---------------------------------------------------------------------------
-- Supplier performance scores (org + vendor aggregate; no customer PII)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_supplier_performance_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vendor_id uuid not null references public.blitzpay_vendors (id) on delete cascade,
  score_period text not null check (score_period in ('monthly', 'quarterly', 'yearly')),
  fulfillment_score integer
    check (fulfillment_score is null or (fulfillment_score >= 0 and fulfillment_score <= 100)),
  pricing_score integer
    check (pricing_score is null or (pricing_score >= 0 and pricing_score <= 100)),
  rebate_score integer
    check (rebate_score is null or (rebate_score >= 0 and rebate_score <= 100)),
  delivery_score integer
    check (delivery_score is null or (delivery_score >= 0 and delivery_score <= 100)),
  support_score integer
    check (support_score is null or (support_score >= 0 and support_score <= 100)),
  overall_score integer
    check (overall_score is null or (overall_score >= 0 and overall_score <= 100)),
  supporting_metrics jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_supplier_perf_org_vendor
  on public.blitzpay_supplier_performance_scores (organization_id, vendor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Vendor financing network offers (orchestration visibility only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_vendor_financing_network_offers (
  id uuid primary key default gen_random_uuid(),
  supplier_network_id uuid references public.blitzpay_supplier_networks (id) on delete set null,
  vendor_id uuid references public.blitzpay_vendors (id) on delete set null,
  offer_status text not null default 'active'
    check (offer_status in ('active', 'expired', 'archived')),
  financing_type text not null
    check (financing_type in (
      'inventory_financing', 'equipment_financing', 'receivables_financing', 'vendor_terms_extension', 'custom'
    )),
  estimated_financing_capacity_cents bigint
    check (estimated_financing_capacity_cents is null or estimated_financing_capacity_cents >= 0),
  estimated_cost_basis_points integer
    check (estimated_cost_basis_points is null or (estimated_cost_basis_points >= 0 and estimated_cost_basis_points <= 10000)),
  estimated_term_days integer
    check (estimated_term_days is null or (estimated_term_days >= 0 and estimated_term_days <= 36500)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blitzpay_vendor_fin_net_offer_ref check (supplier_network_id is not null or vendor_id is not null)
);

create index if not exists idx_blitzpay_vendor_fin_offers_net
  on public.blitzpay_vendor_financing_network_offers (supplier_network_id, offer_status);

-- ---------------------------------------------------------------------------
-- Supplier network audit log (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_supplier_network_audit_log (
  id uuid primary key default gen_random_uuid(),
  supplier_network_id uuid references public.blitzpay_supplier_networks (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  audit_type text not null
    check (audit_type in (
      'network_created', 'member_joined', 'member_removed', 'preferred_program_created',
      'bulk_opportunity_created', 'financing_offer_created', 'benchmark_generated', 'manual_override'
    )),
  actor_type text not null default 'system'
    check (actor_type in ('system', 'admin', 'user')),
  actor_id uuid,
  audit_summary text not null,
  immutable_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.blitzpay_supplier_network_audit_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'blitzpay_supplier_network_audit_immutable';
end;
$$;

drop trigger if exists trg_blitzpay_supplier_net_audit_block_update on public.blitzpay_supplier_network_audit_log;
create trigger trg_blitzpay_supplier_net_audit_block_update
before update on public.blitzpay_supplier_network_audit_log
for each row execute function public.blitzpay_supplier_network_audit_block_mutation();

drop trigger if exists trg_blitzpay_supplier_net_audit_block_delete on public.blitzpay_supplier_network_audit_log;
create trigger trg_blitzpay_supplier_net_audit_block_delete
before delete on public.blitzpay_supplier_network_audit_log
for each row execute function public.blitzpay_supplier_network_audit_block_mutation();

create index if not exists idx_blitzpay_supplier_net_audit_net_created
  on public.blitzpay_supplier_network_audit_log (supplier_network_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Shared procurement benchmarks (aggregate only)
-- ---------------------------------------------------------------------------
create table if not exists public.blitzpay_shared_procurement_benchmarks (
  id uuid primary key default gen_random_uuid(),
  supplier_network_id uuid not null references public.blitzpay_supplier_networks (id) on delete cascade,
  benchmark_type text not null
    check (benchmark_type in (
      'procurement_cost', 'inventory_turnover', 'rebate_capture', 'supplier_performance', 'financing_usage', 'purchasing_efficiency'
    )),
  benchmark_period text not null check (benchmark_period in ('monthly', 'quarterly', 'yearly')),
  benchmark_score integer
    check (benchmark_score is null or (benchmark_score >= 0 and benchmark_score <= 100)),
  benchmark_summary text,
  supporting_metrics jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_blitzpay_shared_proc_benchmarks_net_type
  on public.blitzpay_shared_procurement_benchmarks (supplier_network_id, benchmark_type, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers (mutable tables)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_blitzpay_supplier_networks_updated on public.blitzpay_supplier_networks;
create trigger trg_blitzpay_supplier_networks_updated
before update on public.blitzpay_supplier_networks
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_supplier_net_members_updated on public.blitzpay_supplier_network_members;
create trigger trg_blitzpay_supplier_net_members_updated
before update on public.blitzpay_supplier_network_members
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_pref_vendor_programs_updated on public.blitzpay_preferred_vendor_programs;
create trigger trg_blitzpay_pref_vendor_programs_updated
before update on public.blitzpay_preferred_vendor_programs
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_bulk_purchase_updated on public.blitzpay_bulk_purchase_opportunities;
create trigger trg_blitzpay_bulk_purchase_updated
before update on public.blitzpay_bulk_purchase_opportunities
for each row execute function public.set_updated_at();

drop trigger if exists trg_blitzpay_vendor_fin_offers_updated on public.blitzpay_vendor_financing_network_offers;
create trigger trg_blitzpay_vendor_fin_offers_updated
before update on public.blitzpay_vendor_financing_network_offers
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
revoke all on table public.blitzpay_supplier_networks from public, anon;
revoke all on table public.blitzpay_supplier_network_members from public, anon;
revoke all on table public.blitzpay_preferred_vendor_programs from public, anon;
revoke all on table public.blitzpay_bulk_purchase_opportunities from public, anon;
revoke all on table public.blitzpay_supplier_performance_scores from public, anon;
revoke all on table public.blitzpay_vendor_financing_network_offers from public, anon;
revoke all on table public.blitzpay_supplier_network_audit_log from public, anon;
revoke all on table public.blitzpay_shared_procurement_benchmarks from public, anon;

grant select on table public.blitzpay_supplier_networks to authenticated;
grant select on table public.blitzpay_supplier_network_members to authenticated;
grant select on table public.blitzpay_preferred_vendor_programs to authenticated;
grant select on table public.blitzpay_bulk_purchase_opportunities to authenticated;
grant select on table public.blitzpay_supplier_performance_scores to authenticated;
grant select on table public.blitzpay_vendor_financing_network_offers to authenticated;
grant select on table public.blitzpay_supplier_network_audit_log to authenticated;
grant select on table public.blitzpay_shared_procurement_benchmarks to authenticated;

alter table public.blitzpay_supplier_networks enable row level security;
alter table public.blitzpay_supplier_networks force row level security;
alter table public.blitzpay_supplier_network_members enable row level security;
alter table public.blitzpay_supplier_network_members force row level security;
alter table public.blitzpay_preferred_vendor_programs enable row level security;
alter table public.blitzpay_preferred_vendor_programs force row level security;
alter table public.blitzpay_bulk_purchase_opportunities enable row level security;
alter table public.blitzpay_bulk_purchase_opportunities force row level security;
alter table public.blitzpay_supplier_performance_scores enable row level security;
alter table public.blitzpay_supplier_performance_scores force row level security;
alter table public.blitzpay_vendor_financing_network_offers enable row level security;
alter table public.blitzpay_vendor_financing_network_offers force row level security;
alter table public.blitzpay_supplier_network_audit_log enable row level security;
alter table public.blitzpay_supplier_network_audit_log force row level security;
alter table public.blitzpay_shared_procurement_benchmarks enable row level security;
alter table public.blitzpay_shared_procurement_benchmarks force row level security;

-- Networks: anchor finance OR active member with finance on member org.
drop policy if exists "blitzpay_supplier_networks_select_finance" on public.blitzpay_supplier_networks;
create policy "blitzpay_supplier_networks_select_finance"
on public.blitzpay_supplier_networks
for select
to authenticated
using (
  public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[])
  or exists (
    select 1
    from public.blitzpay_supplier_network_members m
    inner join public.organization_members om
      on om.organization_id = m.organization_id
     and om.user_id = (select auth.uid())
     and om.status = 'active'
    where m.supplier_network_id = blitzpay_supplier_networks.id
      and m.member_status = 'active'
      and public.has_org_role (m.organization_id, array['owner', 'admin', 'manager']::text[])
  )
);

drop policy if exists "blitzpay_supplier_net_members_select_finance" on public.blitzpay_supplier_network_members;
create policy "blitzpay_supplier_net_members_select_finance"
on public.blitzpay_supplier_network_members
for select
to authenticated
using (
  public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[])
  or exists (
    select 1
    from public.blitzpay_supplier_networks n
    where n.id = blitzpay_supplier_network_members.supplier_network_id
      and public.has_org_role (n.organization_id, array['owner', 'admin', 'manager']::text[])
  )
  or exists (
    select 1
    from public.blitzpay_supplier_network_members m2
    inner join public.organization_members om
      on om.organization_id = m2.organization_id
     and om.user_id = (select auth.uid())
     and om.status = 'active'
    where m2.supplier_network_id = blitzpay_supplier_network_members.supplier_network_id
      and m2.member_status = 'active'
      and public.has_org_role (m2.organization_id, array['owner', 'admin', 'manager']::text[])
  )
);

-- Preferred programs: vendor org finance OR network member (when network set).
drop policy if exists "blitzpay_pref_vendor_programs_select_finance" on public.blitzpay_preferred_vendor_programs;
create policy "blitzpay_pref_vendor_programs_select_finance"
on public.blitzpay_preferred_vendor_programs
for select
to authenticated
using (
  exists (
    select 1
    from public.blitzpay_vendors v
    where v.id = blitzpay_preferred_vendor_programs.vendor_id
      and public.has_org_role (v.organization_id, array['owner', 'admin', 'manager']::text[])
  )
  or (
    supplier_network_id is not null
    and exists (
      select 1
      from public.blitzpay_supplier_networks n
      where n.id = blitzpay_preferred_vendor_programs.supplier_network_id
        and (
          public.has_org_role (n.organization_id, array['owner', 'admin', 'manager']::text[])
          or exists (
            select 1
            from public.blitzpay_supplier_network_members m
            inner join public.organization_members om
              on om.organization_id = m.organization_id
             and om.user_id = (select auth.uid())
             and om.status = 'active'
            where m.supplier_network_id = n.id
              and m.member_status = 'active'
              and public.has_org_role (m.organization_id, array['owner', 'admin', 'manager']::text[])
          )
        )
    )
  )
);

drop policy if exists "blitzpay_bulk_purchase_select_finance" on public.blitzpay_bulk_purchase_opportunities;
create policy "blitzpay_bulk_purchase_select_finance"
on public.blitzpay_bulk_purchase_opportunities
for select
to authenticated
using (
  exists (
    select 1
    from public.blitzpay_supplier_networks n
    where n.id = blitzpay_bulk_purchase_opportunities.supplier_network_id
      and (
        public.has_org_role (n.organization_id, array['owner', 'admin', 'manager']::text[])
        or exists (
          select 1
          from public.blitzpay_supplier_network_members m
          inner join public.organization_members om
            on om.organization_id = m.organization_id
           and om.user_id = (select auth.uid())
           and om.status = 'active'
          where m.supplier_network_id = n.id
            and m.member_status = 'active'
            and public.has_org_role (m.organization_id, array['owner', 'admin', 'manager']::text[])
        )
      )
  )
);

drop policy if exists "blitzpay_supplier_perf_scores_select_finance" on public.blitzpay_supplier_performance_scores;
create policy "blitzpay_supplier_perf_scores_select_finance"
on public.blitzpay_supplier_performance_scores
for select
to authenticated
using (
  public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[])
);

drop policy if exists "blitzpay_vendor_fin_offers_select_finance" on public.blitzpay_vendor_financing_network_offers;
create policy "blitzpay_vendor_fin_offers_select_finance"
on public.blitzpay_vendor_financing_network_offers
for select
to authenticated
using (
  (
    vendor_id is not null
    and exists (
      select 1 from public.blitzpay_vendors v
      where v.id = blitzpay_vendor_financing_network_offers.vendor_id
        and public.has_org_role (v.organization_id, array['owner', 'admin', 'manager']::text[])
    )
  )
  or (
    supplier_network_id is not null
    and exists (
      select 1 from public.blitzpay_supplier_networks n
      where n.id = blitzpay_vendor_financing_network_offers.supplier_network_id
        and (
          public.has_org_role (n.organization_id, array['owner', 'admin', 'manager']::text[])
          or exists (
            select 1
            from public.blitzpay_supplier_network_members m
            inner join public.organization_members om
              on om.organization_id = m.organization_id
             and om.user_id = (select auth.uid())
             and om.status = 'active'
            where m.supplier_network_id = n.id
              and m.member_status = 'active'
              and public.has_org_role (m.organization_id, array['owner', 'admin', 'manager']::text[])
          )
        )
    )
  )
);

drop policy if exists "blitzpay_supplier_net_audit_select_finance" on public.blitzpay_supplier_network_audit_log;
create policy "blitzpay_supplier_net_audit_select_finance"
on public.blitzpay_supplier_network_audit_log
for select
to authenticated
using (
  (
    supplier_network_id is null
    and organization_id is not null
    and public.has_org_role (organization_id, array['owner', 'admin', 'manager']::text[])
  )
  or exists (
    select 1
    from public.blitzpay_supplier_networks n
    where n.id = blitzpay_supplier_network_audit_log.supplier_network_id
      and (
        public.has_org_role (n.organization_id, array['owner', 'admin', 'manager']::text[])
        or exists (
          select 1
          from public.blitzpay_supplier_network_members m
          inner join public.organization_members om
            on om.organization_id = m.organization_id
           and om.user_id = (select auth.uid())
           and om.status = 'active'
          where m.supplier_network_id = n.id
            and m.member_status = 'active'
            and public.has_org_role (m.organization_id, array['owner', 'admin', 'manager']::text[])
        )
      )
  )
);

drop policy if exists "blitzpay_shared_proc_benchmarks_select_finance" on public.blitzpay_shared_procurement_benchmarks;
create policy "blitzpay_shared_proc_benchmarks_select_finance"
on public.blitzpay_shared_procurement_benchmarks
for select
to authenticated
using (
  exists (
    select 1
    from public.blitzpay_supplier_networks n
    where n.id = blitzpay_shared_procurement_benchmarks.supplier_network_id
      and (
        public.has_org_role (n.organization_id, array['owner', 'admin', 'manager']::text[])
        or exists (
          select 1
          from public.blitzpay_supplier_network_members m
          inner join public.organization_members om
            on om.organization_id = m.organization_id
           and om.user_id = (select auth.uid())
           and om.status = 'active'
          where m.supplier_network_id = n.id
            and m.member_status = 'active'
            and public.has_org_role (m.organization_id, array['owner', 'admin', 'manager']::text[])
        )
      )
  )
);
