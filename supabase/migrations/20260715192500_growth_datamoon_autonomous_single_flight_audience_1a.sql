-- GE-AIOS-DATAMOON-SINGLE-FLIGHT-AUDIENCE-CREATION-CLOSURE-1A
-- At most one active autonomous Prospect Search DataMoon audience per organization.

create unique index if not exists idx_growth_datamoon_autonomous_active_org_single_flight
  on growth.datamoon_audience_import_runs (
    (provider_metadata #>> '{autonomous_prospect_search_1a,organization_id}')
  )
  where status in ('pending_build', 'building')
    and run_name like 'ge-aios-autonomous-prospect-search:%'
    and (provider_metadata #>> '{autonomous_prospect_search_1a,organization_id}') is not null;
