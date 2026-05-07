-- Leads + Follow-Up Phase 1: lightweight Prospects table.
--
-- Distinct from `customers` so converted prospects keep their pre-conversion
-- pipeline history without polluting the customer record. Mirrors the
-- organization_id / RLS / triggers pattern used by `customers`.
--
-- Strictly additive + idempotent: every CREATE / ALTER guards `if not exists`
-- (or drop-if-exists/recreate), and the only existing-table change is to
-- widen `communication_events.related_entity_type_check` so prospect events
-- can deep-link without a separate timeline table.

create extension if not exists "citext";

-- -----------------------------------------------------------------------------
-- prospects
-- -----------------------------------------------------------------------------

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_name text not null check (char_length(trim(company_name)) > 0),
  contact_name text,
  contact_email citext,
  contact_phone text,
  lead_source text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'follow_up', 'quoted', 'won', 'lost')),
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  estimated_value_cents bigint
    check (estimated_value_cents is null or estimated_value_cents >= 0),
  notes text,
  -- Conversion linkage. `set null` keeps prospect history intact even if the
  -- linked customer is later archived/deleted.
  converted_customer_id uuid references public.customers (id) on delete set null,
  converted_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prospects_org
  on public.prospects (organization_id);
create index if not exists idx_prospects_org_status
  on public.prospects (organization_id, status);
create index if not exists idx_prospects_org_followup
  on public.prospects (organization_id, next_follow_up_at);
create index if not exists idx_prospects_org_archived
  on public.prospects (organization_id, archived_at);
create index if not exists idx_prospects_converted_customer
  on public.prospects (converted_customer_id)
  where converted_customer_id is not null;

comment on table public.prospects is
  'Leads / prospects pipeline (Leads Phase 1). Converts into customers via API; preserves pre-conversion history.';
comment on column public.prospects.next_follow_up_at is
  'When the next follow-up is due. Used by overdue/today/upcoming filters.';
comment on column public.prospects.estimated_value_cents is
  'Optional rough deal value. Cents to match the rest of the schema.';

-- -----------------------------------------------------------------------------
-- updated_at trigger (re-uses the existing `set_updated_at` helper)
-- -----------------------------------------------------------------------------

drop trigger if exists trg_prospects_set_updated_at on public.prospects;
create trigger trg_prospects_set_updated_at
before update on public.prospects
for each row execute function public.set_updated_at();

drop trigger if exists trg_prospects_immutable_org on public.prospects;
create trigger trg_prospects_immutable_org
before update on public.prospects
for each row execute function public.prevent_organization_id_change();

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

revoke all on table public.prospects from public, anon;
grant select, insert, update, delete on table public.prospects to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.prospects enable row level security;

drop policy if exists "prospects_select_member" on public.prospects;
create policy "prospects_select_member"
on public.prospects
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "prospects_insert_owner_admin_manager" on public.prospects;
create policy "prospects_insert_owner_admin_manager"
on public.prospects
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "prospects_update_owner_admin_manager" on public.prospects;
create policy "prospects_update_owner_admin_manager"
on public.prospects
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
)
with check (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

drop policy if exists "prospects_delete_owner_admin_manager" on public.prospects;
create policy "prospects_delete_owner_admin_manager"
on public.prospects
for delete
to authenticated
using (
  public.has_org_role(organization_id, array['owner', 'admin', 'manager'])
);

-- -----------------------------------------------------------------------------
-- communication_events: widen related_entity_type to include 'prospect' so
-- follow-up notes and emails can deep-link without a separate timeline table.
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'communication_events_related_entity_type_check'
  ) then
    alter table public.communication_events
      drop constraint communication_events_related_entity_type_check;
  end if;
end $$;

alter table public.communication_events
  add constraint communication_events_related_entity_type_check
  check (
    related_entity_type is null
    or related_entity_type in (
      'work_order',
      'quote',
      'invoice',
      'maintenance_plan',
      'customer',
      'equipment',
      'organization',
      'prospect'
    )
  );
