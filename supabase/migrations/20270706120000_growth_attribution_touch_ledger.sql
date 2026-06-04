-- Phase 6.32B-1 — Normalized attribution touch ledger + paths.

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
  if to_regclass('growth.opportunities') is null then
    raise exception 'Missing dependency: growth.opportunities';
  end if;
end;
$$;

create table if not exists growth.attribution_touches (
  id uuid primary key default gen_random_uuid(),
  touch_type text not null
    check (touch_type in (
      'lead_import',
      'research',
      'personalization',
      'email_send',
      'sms_send',
      'call',
      'meeting',
      'reply',
      'opportunity_created',
      'opportunity_won'
    )),
  touched_at timestamptz not null default now(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  opportunity_id uuid references growth.opportunities (id) on delete set null,
  channel text,
  sequence_id uuid,
  sequence_step_id uuid,
  sequence_enrollment_id uuid,
  sender_account_id uuid,
  rep_user_id uuid,
  campaign_id uuid,
  delivery_attempt_id uuid references growth.delivery_attempts (id) on delete set null,
  revenue_attribution_event_id uuid references growth.revenue_attribution_events (id) on delete set null,
  attribution_source text not null default 'growth_engine',
  attribution_confidence numeric(5,4) not null default 1.0000
    check (attribution_confidence >= 0 and attribution_confidence <= 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_attribution_touches_lead_time
  on growth.attribution_touches (lead_id, touched_at asc);

create index if not exists idx_growth_attribution_touches_opportunity_time
  on growth.attribution_touches (opportunity_id, touched_at asc)
  where opportunity_id is not null;

create index if not exists idx_growth_attribution_touches_type
  on growth.attribution_touches (touch_type, touched_at desc);

create index if not exists idx_growth_attribution_touches_sequence
  on growth.attribution_touches (sequence_id, touched_at desc)
  where sequence_id is not null;

comment on table growth.attribution_touches is
  'Normalized funnel touches for revenue attribution (Phase 6.32B-1).';

create table if not exists growth.attribution_paths (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  opportunity_id uuid references growth.opportunities (id) on delete cascade,
  path_scope text not null default 'lead'
    check (path_scope in ('lead', 'opportunity')),
  touch_ids uuid[] not null default '{}'::uuid[],
  first_touch_id uuid references growth.attribution_touches (id) on delete set null,
  last_touch_id uuid references growth.attribution_touches (id) on delete set null,
  first_touch_type text,
  last_touch_type text,
  touch_count integer not null default 0,
  channels text[] not null default '{}'::text[],
  attribution_sources text[] not null default '{}'::text[],
  path_summary jsonb not null default '{}'::jsonb,
  rebuilt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_growth_attribution_paths_lead_scope
  on growth.attribution_paths (lead_id, path_scope)
  where path_scope = 'lead' and opportunity_id is null;

create unique index if not exists idx_growth_attribution_paths_opportunity_scope
  on growth.attribution_paths (lead_id, opportunity_id)
  where path_scope = 'opportunity' and opportunity_id is not null;

create index if not exists idx_growth_attribution_paths_lead
  on growth.attribution_paths (lead_id, path_scope);

comment on table growth.attribution_paths is
  'Ordered first/last touch path rebuilt from attribution_touches.';

revoke all on table growth.attribution_touches from public, anon, authenticated;
revoke all on table growth.attribution_paths from public, anon, authenticated;
grant select, insert, update, delete on table growth.attribution_touches to service_role;
grant select, insert, update, delete on table growth.attribution_paths to service_role;
alter table growth.attribution_touches enable row level security;
alter table growth.attribution_paths enable row level security;
alter table growth.attribution_touches force row level security;
alter table growth.attribution_paths force row level security;

drop policy if exists growth_attribution_touches_service_role on growth.attribution_touches;
create policy growth_attribution_touches_service_role
  on growth.attribution_touches for all to service_role using (true) with check (true);

drop policy if exists growth_attribution_paths_service_role on growth.attribution_paths;
create policy growth_attribution_paths_service_role
  on growth.attribution_paths for all to service_role using (true) with check (true);
