-- Growth Engine — Company Signal Intelligence (Prompt 30).
-- Evidence-backed operational signals per company candidate.

do $$
begin
  if to_regclass('growth.real_world_company_candidates') is null then
    raise exception 'Missing dependency: growth.real_world_company_candidates';
  end if;
end;
$$;

create table if not exists growth.company_signal_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company_candidate_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'partial', 'failed')),
  signal_count int not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists growth.company_signals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  run_id uuid not null references growth.company_signal_runs (id) on delete cascade,
  company_candidate_id uuid not null,
  signal_category text not null default ''
    check (signal_category in (
      'technology',
      'operations',
      'growth',
      'service_model',
      'finance',
      'staffing',
      'digital_presence',
      'field_service'
    )),
  signal_type text not null default '',
  signal_value text not null default '',
  confidence numeric not null default 0,
  evidence jsonb not null default '[]'::jsonb,
  source_attribution jsonb not null default '[]'::jsonb,
  observed_at timestamptz not null default now(),
  dedupe_hash text not null default '',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists company_signal_runs_company_idx
  on growth.company_signal_runs (company_candidate_id, created_at desc);

create index if not exists company_signals_run_idx
  on growth.company_signals (run_id, signal_category);

create index if not exists company_signals_company_idx
  on growth.company_signals (company_candidate_id, confidence desc);

create index if not exists company_signals_dedupe_idx
  on growth.company_signals (company_candidate_id, dedupe_hash);

revoke all on table growth.company_signal_runs from public, anon, authenticated;
revoke all on table growth.company_signals from public, anon, authenticated;
