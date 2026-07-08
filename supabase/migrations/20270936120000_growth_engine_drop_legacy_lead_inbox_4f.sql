-- GE-LEADS-CANONICAL-4F — Drop legacy growth.lead_inbox table and orphaned columns.
-- Preconditions: growth.lead_inbox row count = 0; runtime no longer references these columns.

do $$
declare
  inbox_count bigint;
begin
  select count(*) into inbox_count from growth.lead_inbox;
  if inbox_count > 0 then
    raise exception 'Refusing drop: growth.lead_inbox has % rows', inbox_count;
  end if;
end;
$$;

-- Intelligence FKs + columns
alter table growth.search_intent_signals
  drop constraint if exists search_intent_signals_lead_inbox_id_fkey;

drop index if exists growth.search_intent_signals_lead_inbox_id_intent_score_idx;

alter table growth.search_intent_signals
  drop column if exists lead_inbox_id;

alter table growth.buying_stage_assessments
  drop constraint if exists buying_stage_assessments_lead_inbox_id_fkey;

drop index if exists growth.buying_stage_assessments_lead_inbox_id_stage_score_idx;

alter table growth.buying_stage_assessments
  drop column if exists lead_inbox_id;

alter table growth.company_identification_matches
  drop constraint if exists company_identification_matches_lead_inbox_id_fkey;

drop index if exists growth.company_identification_matches_lead_inbox_id_match_score_idx;

alter table growth.company_identification_matches
  drop column if exists lead_inbox_id;

-- Signal foundation legacy columns
alter table growth.signals
  drop column if exists processed_to_lead_inbox;

alter table growth.signals
  drop column if exists lead_inbox_id;

-- Prospect search materialized index
update growth.prospect_search_index
set is_active = false,
    indexed_at = now()
where source_type = 'lead_inbox';

drop index if exists growth.prospect_search_index_account_flags_idx;

alter table growth.prospect_search_index
  drop column if exists is_in_lead_inbox;

create index if not exists prospect_search_index_account_flags_idx
  on growth.prospect_search_index (is_customer, is_prospect)
  where is_active = true;

alter table growth.prospect_search_index
  drop constraint if exists prospect_search_index_source_type_check;

alter table growth.prospect_search_index
  add constraint prospect_search_index_source_type_check
  check (source_type in ('growth_lead', 'crm_prospect', 'crm_customer', 'external_discovered'));

-- Legacy queue table (empty)
drop table if exists growth.lead_inbox cascade;
