-- Growth Engine — Signal watchlists + trigger rules foundation (Milestone D).
-- Operator monitoring views and manual trigger evaluation only. Service-role access only.

do $$
begin
  if to_regnamespace('growth') is null then
    raise exception 'Missing dependency: growth schema';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'Missing dependency: public.set_updated_at()';
  end if;
  if to_regclass('growth.signals') is null then
    raise exception 'Missing dependency: growth.signals (apply signal foundation migration first)';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.signal_watchlists
-- -----------------------------------------------------------------------------

create table if not exists growth.signal_watchlists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  signal_types text[] not null default '{}'::text[],
  filters jsonb not null default '{}'::jsonb,
  match_count integer not null default 0 check (match_count >= 0),
  last_evaluated_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists signal_watchlists_org_updated_idx
  on growth.signal_watchlists (organization_id, updated_at desc)
  where archived_at is null;

-- -----------------------------------------------------------------------------
-- growth.signal_trigger_rules
-- -----------------------------------------------------------------------------

create table if not exists growth.signal_trigger_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  watchlist_id uuid references growth.signal_watchlists(id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  enabled boolean not null default false,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  safety_mode text not null default 'manual_review'
    check (safety_mode in ('manual_review', 'suggest_only', 'disabled')),
  last_evaluated_at timestamptz,
  last_match_count integer not null default 0 check (last_match_count >= 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists signal_trigger_rules_watchlist_idx
  on growth.signal_trigger_rules (watchlist_id, updated_at desc)
  where archived_at is null;

-- -----------------------------------------------------------------------------
-- growth.signal_watchlist_matches
-- -----------------------------------------------------------------------------

create table if not exists growth.signal_watchlist_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  watchlist_id uuid not null references growth.signal_watchlists(id) on delete cascade,
  signal_id uuid not null references growth.signals(id) on delete cascade,
  matched_at timestamptz not null default now(),
  match_reason jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (watchlist_id, signal_id)
);

create index if not exists signal_watchlist_matches_watchlist_idx
  on growth.signal_watchlist_matches (watchlist_id, matched_at desc);

create index if not exists signal_watchlist_matches_signal_idx
  on growth.signal_watchlist_matches (signal_id);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

drop trigger if exists signal_watchlists_set_updated_at on growth.signal_watchlists;
create trigger signal_watchlists_set_updated_at
  before update on growth.signal_watchlists
  for each row execute function public.set_updated_at();

drop trigger if exists signal_trigger_rules_set_updated_at on growth.signal_trigger_rules;
create trigger signal_trigger_rules_set_updated_at
  before update on growth.signal_trigger_rules
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- grants + RLS (service_role only)
-- -----------------------------------------------------------------------------

revoke all on table growth.signal_watchlists from public, anon, authenticated;
revoke all on table growth.signal_trigger_rules from public, anon, authenticated;
revoke all on table growth.signal_watchlist_matches from public, anon, authenticated;

grant select, insert, update, delete on table growth.signal_watchlists to service_role;
grant select, insert, update, delete on table growth.signal_trigger_rules to service_role;
grant select, insert, update, delete on table growth.signal_watchlist_matches to service_role;

alter table growth.signal_watchlists enable row level security;
alter table growth.signal_trigger_rules enable row level security;
alter table growth.signal_watchlist_matches enable row level security;

comment on table growth.signal_watchlists is
  'Operator saved monitoring views for intent signals (Milestone D). Manual refresh only — no autonomous outreach.';

comment on table growth.signal_trigger_rules is
  'Trigger rule foundation (Milestone D). Rules default disabled; actions stored but not executed automatically.';

comment on table growth.signal_watchlist_matches is
  'Materialized watchlist-to-signal matches with deterministic match_reason payloads.';
