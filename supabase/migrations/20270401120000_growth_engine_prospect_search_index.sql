-- Growth Engine — Materialized Prospect Search index (Sprint 4A).
-- Platform Growth Engine only — service_role access via API.

do $$
begin
  if to_regclass('growth.lead_inbox') is null then
    raise exception 'Missing dependency: growth.lead_inbox';
  end if;
end;
$$;

create table if not exists growth.prospect_search_index (
  id uuid primary key default gen_random_uuid(),
  source_type text not null
    check (source_type in ('growth_lead', 'lead_inbox', 'crm_prospect', 'crm_customer')),
  source_id text not null,
  company_name text not null default '',
  normalized_company_name text not null default '',
  domain text,
  website text,
  email_domain text,
  phone text,
  city text,
  state text,
  postal_code text,
  country text,
  location_label text,
  industry text,
  vertical text,
  service_area text,
  employee_count integer,
  employee_range text,
  estimated_annual_revenue numeric,
  revenue_range text,
  crm_detected text,
  field_service_software text,
  website_platform text,
  technologies jsonb not null default '[]'::jsonb,
  company_signal_summary jsonb,
  signal_confidence numeric,
  signal_count integer not null default 0,
  lead_engine_score integer,
  lead_engine_score_label text,
  buying_stage text,
  buying_stage_confidence numeric,
  intent_score numeric,
  company_match_confidence numeric,
  existing_account_status text not null default 'none',
  is_customer boolean not null default false,
  is_prospect boolean not null default false,
  is_in_lead_inbox boolean not null default false,
  is_suppressed boolean not null default false,
  suppression_reason_safe text,
  suppression_scope_safe text,
  source_updated_at timestamptz,
  indexed_at timestamptz not null default now(),
  search_text tsvector,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  unique (source_type, source_id)
);

create index if not exists prospect_search_index_source_type_idx
  on growth.prospect_search_index (source_type, is_active);

create index if not exists prospect_search_index_normalized_name_idx
  on growth.prospect_search_index (normalized_company_name)
  where is_active = true;

create index if not exists prospect_search_index_domain_idx
  on growth.prospect_search_index (domain)
  where is_active = true and domain is not null;

create index if not exists prospect_search_index_state_city_idx
  on growth.prospect_search_index (state, city)
  where is_active = true;

create index if not exists prospect_search_index_industry_idx
  on growth.prospect_search_index (industry)
  where is_active = true and industry is not null;

create index if not exists prospect_search_index_account_flags_idx
  on growth.prospect_search_index (is_customer, is_prospect, is_in_lead_inbox)
  where is_active = true;

create index if not exists prospect_search_index_suppressed_idx
  on growth.prospect_search_index (is_suppressed)
  where is_active = true;

create index if not exists prospect_search_index_lead_engine_score_idx
  on growth.prospect_search_index (lead_engine_score desc nulls last)
  where is_active = true;

create index if not exists prospect_search_index_intent_score_idx
  on growth.prospect_search_index (intent_score desc nulls last)
  where is_active = true;

create index if not exists prospect_search_index_indexed_at_idx
  on growth.prospect_search_index (indexed_at desc);

create index if not exists prospect_search_index_search_text_idx
  on growth.prospect_search_index using gin (search_text);

create or replace function growth.prospect_search_index_search_text_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_text :=
    setweight(to_tsvector('simple', coalesce(new.company_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.industry, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.location_label, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.domain, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(new.service_area, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(new.crm_detected, '')), 'D') ||
    setweight(to_tsvector('simple', coalesce(new.field_service_software, '')), 'D');
  return new;
end;
$$;

drop trigger if exists prospect_search_index_search_text_trg on growth.prospect_search_index;
create trigger prospect_search_index_search_text_trg
  before insert or update of company_name, industry, location_label, domain, service_area, crm_detected, field_service_software
  on growth.prospect_search_index
  for each row
  execute function growth.prospect_search_index_search_text_trigger();

grant select, insert, update, delete on table growth.prospect_search_index to service_role;

alter table growth.prospect_search_index enable row level security;
alter table growth.prospect_search_index force row level security;
