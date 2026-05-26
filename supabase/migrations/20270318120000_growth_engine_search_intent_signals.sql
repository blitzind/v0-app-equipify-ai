-- Growth Engine — Search Intent Signal Engine (Prompt 19).
-- Observable traffic signals only (UTM, referrer URL params, site search, paths). No private search APIs.

do $$
begin
  if to_regclass('growth.lead_inbox') is null then
    raise exception 'Missing dependency: growth.lead_inbox';
  end if;
end;
$$;

create table if not exists growth.search_intent_signals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  site_key text not null default '',
  visitor_key text not null default '',
  session_key text not null default '',
  lead_inbox_id uuid references growth.lead_inbox (id) on delete set null,
  company_domain text,
  company_name text,
  keyword text not null default '',
  normalized_keyword text not null default '',
  intent_topic text not null default '',
  intent_category text not null
    check (intent_category in (
      'problem_aware',
      'solution_aware',
      'vendor_comparison',
      'pricing_research',
      'demo_intent',
      'urgent_service_need',
      'competitor_research',
      'local_service_search',
      'industry_research'
    )),
  intent_stage text not null
    check (intent_stage in (
      'awareness',
      'consideration',
      'evaluation',
      'purchase_ready',
      'retention_or_support'
    )),
  intent_strength text not null default 'low'
    check (intent_strength in ('low', 'medium', 'high')),
  intent_score int not null default 0 check (intent_score >= 0 and intent_score <= 100),
  source_type text not null
    check (source_type in (
      'organic_search',
      'paid_search',
      'site_search',
      'utm_keyword',
      'referrer_keyword',
      'content_path',
      'manual_import',
      'future_provider'
    )),
  source_name text,
  landing_page text,
  referrer text,
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_term text not null default '',
  utm_content text not null default '',
  matched_page_path text,
  matched_content_title text,
  matched_query_pattern text,
  evidence text not null default '',
  source_attribution jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists search_intent_signals_inbox_idx
  on growth.search_intent_signals (lead_inbox_id, intent_score desc)
  where lead_inbox_id is not null;

create index if not exists search_intent_signals_visitor_idx
  on growth.search_intent_signals (site_key, visitor_key, created_at desc);

create index if not exists search_intent_signals_category_idx
  on growth.search_intent_signals (intent_category, intent_stage, created_at desc);
