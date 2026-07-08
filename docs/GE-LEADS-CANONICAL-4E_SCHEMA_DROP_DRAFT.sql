-- GE-LEADS-CANONICAL-4E — DRAFT ONLY. Do NOT apply until code blockers are cleared.
-- Placeholder migration filename (when certified): 20270902120000_growth_engine_drop_legacy_lead_inbox_4f.sql
--
-- Preconditions (verify via scripts/certify-ge-leads-canonical-dead-code-drop-readiness-4e.ts):
--   • growth.lead_inbox row count = 0
--   • No runtime .from('lead_inbox') in lib/
--   • Intelligence repos stop writing lead_inbox_id
--   • Signal + prospect-search index code stops referencing legacy columns

begin;

-- ---------------------------------------------------------------------------
-- Phase 1 — Drop FK constraints referencing growth.lead_inbox (BLOCKED: active repo fallbacks)
-- ---------------------------------------------------------------------------

-- alter table growth.search_intent_signals
--   drop constraint if exists search_intent_signals_lead_inbox_id_fkey;
--
-- alter table growth.buying_stage_assessments
--   drop constraint if exists buying_stage_assessments_lead_inbox_id_fkey;
--
-- alter table growth.company_identification_matches
--   drop constraint if exists company_identification_matches_lead_inbox_id_fkey;

-- ---------------------------------------------------------------------------
-- Phase 2 — Drop lead_inbox_id columns on intelligence tables (BLOCKED: transition .or() reads)
-- ---------------------------------------------------------------------------

-- drop index if exists growth.search_intent_signals_lead_inbox_id_intent_score_idx;
-- alter table growth.search_intent_signals drop column if exists lead_inbox_id;
--
-- drop index if exists growth.buying_stage_assessments_lead_inbox_id_stage_score_idx;
-- alter table growth.buying_stage_assessments drop column if exists lead_inbox_id;
--
-- drop index if exists growth.company_identification_matches_lead_inbox_id_match_score_idx;
-- alter table growth.company_identification_matches drop column if exists lead_inbox_id;

-- ---------------------------------------------------------------------------
-- Phase 3 — Drop soft legacy columns (BLOCKED: types + prospect-search overlays)
-- ---------------------------------------------------------------------------

-- alter table growth.signals drop column if exists processed_to_lead_inbox;
-- alter table growth.signals drop column if exists lead_inbox_id;
--
-- drop index if exists growth.prospect_search_index_is_customer_is_prospect_is_in_lead_inbox_idx;
-- alter table growth.prospect_search_index drop column if exists is_in_lead_inbox;

-- ---------------------------------------------------------------------------
-- Phase 4 — Drop growth.lead_inbox table (BLOCKED: schema still referenced by FKs above)
-- ---------------------------------------------------------------------------

-- drop table if exists growth.lead_inbox cascade;

commit;

-- Post-drop verification (run manually after certified apply):
--   select count(*) from growth.lead_inbox; -- should error: relation does not exist
--   select column_name from information_schema.columns
--     where table_schema = 'growth' and column_name like '%lead_inbox%';
