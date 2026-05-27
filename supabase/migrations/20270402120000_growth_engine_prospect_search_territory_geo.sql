-- Growth Engine — Prospect Search index geo columns (Sprint 4B).

do $$
begin
  if to_regclass('growth.prospect_search_index') is null then
    raise exception 'Missing dependency: growth.prospect_search_index';
  end if;
end;
$$;

alter table growth.prospect_search_index
  add column if not exists lat numeric,
  add column if not exists lng numeric,
  add column if not exists metro text,
  add column if not exists normalized_geo_key text;

create index if not exists prospect_search_index_postal_code_idx
  on growth.prospect_search_index (postal_code)
  where is_active = true and postal_code is not null;

create index if not exists prospect_search_index_metro_idx
  on growth.prospect_search_index (metro)
  where is_active = true and metro is not null;

create index if not exists prospect_search_index_normalized_geo_key_idx
  on growth.prospect_search_index (normalized_geo_key)
  where is_active = true and normalized_geo_key is not null;

create index if not exists prospect_search_index_state_only_idx
  on growth.prospect_search_index (state)
  where is_active = true and state is not null;
