-- Growth Engine — Prospect Search + Real-World Discovery production readiness.
-- Adds missing service_role grants (saved searches + discovery persistence).

do $$
begin
  if to_regnamespace('growth') is null then
    raise exception 'Missing dependency: growth schema';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- prospect_search_saved_searches / lists / list_members
-- -----------------------------------------------------------------------------

revoke all on table growth.prospect_search_saved_searches from public, anon, authenticated;
revoke all on table growth.prospect_search_lists from public, anon, authenticated;
revoke all on table growth.prospect_search_list_members from public, anon, authenticated;

grant select, insert, update, delete on table growth.prospect_search_saved_searches to service_role;
grant select, insert, update, delete on table growth.prospect_search_lists to service_role;
grant select, insert, update, delete on table growth.prospect_search_list_members to service_role;

alter table growth.prospect_search_saved_searches enable row level security;
alter table growth.prospect_search_lists enable row level security;
alter table growth.prospect_search_list_members enable row level security;

drop trigger if exists prospect_search_saved_searches_set_updated_at on growth.prospect_search_saved_searches;
create trigger prospect_search_saved_searches_set_updated_at
  before update on growth.prospect_search_saved_searches
  for each row execute function public.set_updated_at();

drop trigger if exists prospect_search_lists_set_updated_at on growth.prospect_search_lists;
create trigger prospect_search_lists_set_updated_at
  before update on growth.prospect_search_lists
  for each row execute function public.set_updated_at();

comment on table growth.prospect_search_saved_searches is
  'Saved Prospect Search workflows (service_role only). QA: growth-saved-search-schema-ready-v1';

-- -----------------------------------------------------------------------------
-- real_world_discovery (Prompt 29) — grants were missing after revoke
-- -----------------------------------------------------------------------------

revoke all on table growth.real_world_discovery_runs from public, anon, authenticated;
revoke all on table growth.real_world_company_candidates from public, anon, authenticated;

grant select, insert, update, delete on table growth.real_world_discovery_runs to service_role;
grant select, insert, update, delete on table growth.real_world_company_candidates to service_role;

alter table growth.real_world_discovery_runs enable row level security;
alter table growth.real_world_company_candidates enable row level security;

-- -----------------------------------------------------------------------------
-- external_company_discovery (Prompt 26) — grants were missing
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('growth.external_company_discovery_runs') is not null then
    revoke all on table growth.external_company_discovery_runs from public, anon, authenticated;
    grant select, insert, update, delete on table growth.external_company_discovery_runs to service_role;
    alter table growth.external_company_discovery_runs enable row level security;
  end if;
  if to_regclass('growth.external_company_candidates') is not null then
    revoke all on table growth.external_company_candidates from public, anon, authenticated;
    grant select, insert, update, delete on table growth.external_company_candidates to service_role;
    alter table growth.external_company_candidates enable row level security;
  end if;
end;
$$;
