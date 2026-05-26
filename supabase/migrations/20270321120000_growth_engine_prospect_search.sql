-- Growth Engine — Prospect Search + ICP Builder (Prompt 23).
-- Saved searches and lists. Observable data only — no scraping or outbound.

do $$
begin
  if to_regclass('growth.lead_inbox') is null then
    raise exception 'Missing dependency: growth.lead_inbox';
  end if;
end;
$$;

create table if not exists growth.prospect_search_saved_searches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  name text not null default '',
  query_text text not null default '',
  filters jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists growth.prospect_search_lists (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  name text not null default '',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists growth.prospect_search_list_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  list_id uuid not null references growth.prospect_search_lists (id) on delete cascade,
  source_type text not null
    check (source_type in ('growth_lead', 'lead_inbox', 'crm_prospect', 'crm_customer', 'person')),
  source_id text not null default '',
  company_name text not null default '',
  snapshot jsonb not null default '{}'::jsonb,
  unique (list_id, source_type, source_id)
);

create index if not exists prospect_search_saved_searches_created_idx
  on growth.prospect_search_saved_searches (created_at desc);

create index if not exists prospect_search_lists_created_idx
  on growth.prospect_search_lists (created_at desc);

create index if not exists prospect_search_list_members_list_idx
  on growth.prospect_search_list_members (list_id, created_at desc);
