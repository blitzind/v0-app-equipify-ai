-- GE-LEADS-CANONICAL-4C — Canonical growth_lead_id on intelligence tables.
-- Adds nullable FK to growth.leads; retains lead_inbox_id for transition.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

alter table growth.search_intent_signals
  add column if not exists growth_lead_id uuid references growth.leads (id) on delete set null;

alter table growth.buying_stage_assessments
  add column if not exists growth_lead_id uuid references growth.leads (id) on delete set null;

alter table growth.company_identification_matches
  add column if not exists growth_lead_id uuid references growth.leads (id) on delete set null;

create index if not exists search_intent_signals_growth_lead_idx
  on growth.search_intent_signals (growth_lead_id, intent_score desc)
  where growth_lead_id is not null;

create index if not exists buying_stage_assessments_growth_lead_idx
  on growth.buying_stage_assessments (growth_lead_id, stage_score desc)
  where growth_lead_id is not null;

create index if not exists company_identification_matches_growth_lead_idx
  on growth.company_identification_matches (growth_lead_id, match_score desc)
  where growth_lead_id is not null;

-- Backfill from legacy inbox metadata when inbox rows exist (no-op when inbox is empty).
update growth.search_intent_signals sis
set growth_lead_id = nullif(trim(li.metadata ->> 'growth_lead_id'), '')::uuid,
    updated_at = now()
from growth.lead_inbox li
where sis.lead_inbox_id = li.id
  and sis.growth_lead_id is null
  and nullif(trim(li.metadata ->> 'growth_lead_id'), '') is not null;

update growth.buying_stage_assessments bsa
set growth_lead_id = nullif(trim(li.metadata ->> 'growth_lead_id'), '')::uuid,
    updated_at = now()
from growth.lead_inbox li
where bsa.lead_inbox_id = li.id
  and bsa.growth_lead_id is null
  and nullif(trim(li.metadata ->> 'growth_lead_id'), '') is not null;

update growth.company_identification_matches cim
set growth_lead_id = nullif(trim(li.metadata ->> 'growth_lead_id'), '')::uuid,
    updated_at = now()
from growth.lead_inbox li
where cim.lead_inbox_id = li.id
  and cim.growth_lead_id is null
  and nullif(trim(li.metadata ->> 'growth_lead_id'), '') is not null;
