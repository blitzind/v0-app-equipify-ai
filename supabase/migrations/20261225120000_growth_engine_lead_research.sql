-- Growth Engine slice 2A: internal lead research runs + manual notes.
-- Service-role only. No customer Prospects changes.

do $$
begin
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.lead_research_runs
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_research_runs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  status text not null
    check (status in ('queued', 'running', 'succeeded', 'failed', 'partial')),
  trigger_kind text not null default 'manual'
    check (trigger_kind in ('manual', 'regenerate')),
  input_snapshot jsonb not null default '{}'::jsonb,
  website_url text,
  website_fetch_status text not null default 'skipped'
    check (website_fetch_status in ('skipped', 'ok', 'timeout', 'blocked', 'too_large', 'invalid_url', 'error')),
  website_text_excerpt text,
  source_urls text[] not null default '{}'::text[],
  result jsonb,
  research_confidence numeric(4, 3)
    check (research_confidence is null or (research_confidence >= 0 and research_confidence <= 1)),
  equipify_fit_score int
    check (equipify_fit_score is null or (equipify_fit_score >= 0 and equipify_fit_score <= 100)),
  model_task text,
  model_provider text,
  model_name text,
  error_code text,
  error_message text,
  duration_ms int check (duration_ms is null or duration_ms >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_growth_lead_research_runs_lead_created
  on growth.lead_research_runs (lead_id, created_at desc);

create index if not exists idx_growth_lead_research_runs_lead_succeeded
  on growth.lead_research_runs (lead_id, created_at desc)
  where status = 'succeeded';

comment on table growth.lead_research_runs is
  'Append-only AI research runs for internal Growth Engine leads (slice 2A).';

-- -----------------------------------------------------------------------------
-- growth.lead_research_notes
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_research_notes (
  lead_id uuid primary key references growth.leads (id) on delete cascade,
  body text not null default '',
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table growth.lead_research_notes is
  'Manual internal research notes for a Growth Engine lead (one row per lead).';

drop trigger if exists trg_growth_lead_research_notes_set_updated_at on growth.lead_research_notes;
create trigger trg_growth_lead_research_notes_set_updated_at
before update on growth.lead_research_notes
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Privileges — service role only
-- -----------------------------------------------------------------------------

revoke all on table growth.lead_research_runs from public, anon, authenticated;
revoke all on table growth.lead_research_notes from public, anon, authenticated;

grant select, insert, update, delete on table growth.lead_research_runs to service_role;
grant select, insert, update, delete on table growth.lead_research_notes to service_role;

alter table growth.lead_research_runs enable row level security;
alter table growth.lead_research_runs force row level security;

alter table growth.lead_research_notes enable row level security;
alter table growth.lead_research_notes force row level security;
