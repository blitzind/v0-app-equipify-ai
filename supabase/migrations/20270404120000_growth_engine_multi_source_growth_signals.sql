-- Growth Engine — Multi-source evidence + growth signals (Apollo replacement layer).

do $$
begin
  if to_regclass('growth.external_company_candidates') is null then
    raise exception 'Missing dependency: growth.external_company_candidates';
  end if;
end;
$$;

create table if not exists growth.company_evidence_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  source_type text not null
    check (source_type in (
      'website',
      'team_page',
      'contact_page',
      'about_page',
      'careers_page',
      'google_business',
      'linkedin_company',
      'press_news',
      'review_site',
      'job_posting',
      'tech_stack',
      'public_record',
      'manual'
    )),
  source_url text,
  confidence_score numeric not null default 0,
  evidence_excerpt text not null default '',
  observed_at timestamptz not null default now(),
  expires_at timestamptz,
  dedupe_hash text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists growth.company_growth_signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  signal_type text not null
    check (signal_type in (
      'hiring_technicians',
      'hiring_operations',
      'new_location',
      'expansion',
      'website_rebuild',
      'technology_change',
      'review_spike',
      'negative_review_spike',
      'funding_or_acquisition',
      'service_line_expansion',
      'equipment_specialty_detected',
      'competitor_detected',
      'buying_intent',
      'stale_data'
    )),
  confidence_score numeric not null default 0,
  source_type text not null default 'website',
  source_url text,
  evidence_excerpt text not null default '',
  detected_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists growth.company_growth_signal_scores (
  company_id uuid primary key,
  growth_signal_score int not null default 0,
  signal_tier text not null default 'low'
    check (signal_tier in ('low', 'moderate', 'high', 'urgent')),
  top_signals jsonb not null default '[]'::jsonb,
  recommended_next_action text,
  last_computed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists growth.company_growth_signal_refresh_queue (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  reason text not null default 'stale',
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  scheduled_for timestamptz not null default now(),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, reason)
);

create index if not exists company_evidence_sources_company_idx
  on growth.company_evidence_sources (company_id, observed_at desc);

create index if not exists company_evidence_sources_type_idx
  on growth.company_evidence_sources (company_id, source_type);

create unique index if not exists company_evidence_sources_dedupe_idx
  on growth.company_evidence_sources (company_id, dedupe_hash)
  where dedupe_hash <> '';

create index if not exists company_growth_signals_company_idx
  on growth.company_growth_signals (company_id, detected_at desc);

create index if not exists company_growth_signals_company_confidence_idx
  on growth.company_growth_signals (
    company_id,
    confidence_score desc
  );

create index if not exists company_growth_signals_expires_at_idx
  on growth.company_growth_signals (
    expires_at
  );

create index if not exists company_growth_signals_type_idx
  on growth.company_growth_signals (company_id, signal_type);

create index if not exists company_growth_signal_refresh_queue_status_idx
  on growth.company_growth_signal_refresh_queue (status, scheduled_for asc);

revoke all on table growth.company_evidence_sources from public, anon, authenticated;
revoke all on table growth.company_growth_signals from public, anon, authenticated;
revoke all on table growth.company_growth_signal_scores from public, anon, authenticated;
revoke all on table growth.company_growth_signal_refresh_queue from public, anon, authenticated;

grant select, insert, update, delete on table growth.company_evidence_sources to service_role;
grant select, insert, update, delete on table growth.company_growth_signals to service_role;
grant select, insert, update, delete on table growth.company_growth_signal_scores to service_role;
grant select, insert, update, delete on table growth.company_growth_signal_refresh_queue to service_role;

alter table growth.company_evidence_sources enable row level security;
alter table growth.company_growth_signals enable row level security;
alter table growth.company_growth_signal_scores enable row level security;
alter table growth.company_growth_signal_refresh_queue enable row level security;
