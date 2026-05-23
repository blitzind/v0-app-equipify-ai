-- Growth Engine slice 3B.1: decision makers, next best action, company intelligence placeholders.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.leads — NBA cache, decision maker tracking, intelligence placeholders
-- -----------------------------------------------------------------------------

alter table growth.leads
  add column if not exists decision_maker_status text
    check (decision_maker_status is null or decision_maker_status in (
      'none', 'suspected', 'confirmed', 'verified_contactable'
    )),
  add column if not exists primary_decision_maker_id uuid,
  add column if not exists next_best_action text,
  add column if not exists next_best_action_reason text,
  add column if not exists next_best_action_computed_at timestamptz,
  add column if not exists estimated_annual_revenue text,
  add column if not exists estimated_employee_count text,
  add column if not exists fleet_size_estimate text,
  add column if not exists crm_detected text,
  add column if not exists field_service_stack_detected text;

-- -----------------------------------------------------------------------------
-- growth.lead_decision_makers
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_decision_makers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,

  full_name text not null check (char_length(trim(full_name)) > 0),
  title text,
  email citext,
  phone text,
  linkedin_url text,

  source text not null
    check (source in ('website', 'public_web', 'apollo', 'seamless', 'manual', 'lead_contact')),
  source_detail text,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence_excerpt text,

  status text not null default 'suspected'
    check (status in ('suspected', 'confirmed', 'rejected')),
  is_primary boolean not null default false,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_lead_decision_makers_lead
  on growth.lead_decision_makers (lead_id, status, is_primary desc);

create unique index if not exists idx_growth_lead_dm_primary
  on growth.lead_decision_makers (lead_id)
  where is_primary = true and status <> 'rejected';

create index if not exists idx_growth_leads_next_best_action
  on growth.leads (next_best_action, call_priority_score desc nulls last);

alter table growth.leads
  drop constraint if exists growth_leads_primary_decision_maker_id_fkey;

alter table growth.leads
  add constraint growth_leads_primary_decision_maker_id_fkey
  foreign key (primary_decision_maker_id)
  references growth.lead_decision_makers (id)
  on delete set null;

drop trigger if exists trg_growth_lead_decision_makers_updated_at on growth.lead_decision_makers;
create trigger trg_growth_lead_decision_makers_updated_at
  before update on growth.lead_decision_makers
  for each row execute function public.set_updated_at();

comment on table growth.lead_decision_makers is
  'Structured decision maker contacts for Growth Engine leads (slice 3B.1).';

revoke all on table growth.lead_decision_makers from public, anon, authenticated;
grant select, insert, update, delete on table growth.lead_decision_makers to service_role;

alter table growth.lead_decision_makers enable row level security;
alter table growth.lead_decision_makers force row level security;
