-- Growth Engine — Company Identification Engine (Prompt 20).
-- Candidate company matches from observable data + CRM. Not guaranteed identity.

do $$
begin
  if to_regclass('growth.lead_inbox') is null then
    raise exception 'Missing dependency: growth.lead_inbox';
  end if;
end;
$$;

create table if not exists growth.company_identification_matches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  site_key text not null default '',
  visitor_key text not null default '',
  session_key text not null default '',
  lead_inbox_id uuid references growth.lead_inbox (id) on delete set null,
  intent_session_id uuid,
  company_name text not null default '',
  company_domain text,
  matched_customer_id uuid,
  matched_prospect_id uuid,
  matched_growth_lead_id uuid,
  matched_source text not null
    check (matched_source in (
      'email_domain',
      'submitted_identity',
      'utm_domain',
      'referrer_domain',
      'landing_page_domain',
      'company_domain_parameter',
      'crm_customer',
      'crm_prospect',
      'growth_lead',
      'intent_history',
      'future_provider'
    )),
  match_type text not null
    check (match_type in (
      'exact_domain',
      'normalized_domain',
      'email_domain',
      'crm_match',
      'submitted_company',
      'inferred_company',
      'future_enrichment'
    )),
  match_confidence numeric(4, 3) not null default 0 check (match_confidence >= 0 and match_confidence <= 1),
  match_score int not null default 0 check (match_score >= 0 and match_score <= 100),
  match_reasoning jsonb not null default '[]'::jsonb,
  evidence text not null default '',
  source_attribution jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists company_identification_matches_inbox_idx
  on growth.company_identification_matches (lead_inbox_id, match_score desc)
  where lead_inbox_id is not null;

create index if not exists company_identification_matches_visitor_idx
  on growth.company_identification_matches (site_key, visitor_key, created_at desc);

create index if not exists company_identification_matches_domain_idx
  on growth.company_identification_matches (company_domain)
  where company_domain is not null and company_domain <> '';
