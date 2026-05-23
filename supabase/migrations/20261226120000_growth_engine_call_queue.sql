-- Growth Engine slice 3A: call queue workflow (dispositions, priority, call events).

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.leads — call workflow + priority
-- -----------------------------------------------------------------------------

alter table growth.leads
  add column if not exists call_disposition text
    check (call_disposition is null or call_disposition in (
      'call_attempted', 'left_voicemail', 'interested', 'not_a_fit', 'follow_up_later'
    )),
  add column if not exists call_disposition_at timestamptz,
  add column if not exists last_call_at timestamptz,
  add column if not exists follow_up_at timestamptz,
  add column if not exists call_priority_score int
    check (call_priority_score is null or (call_priority_score >= 0 and call_priority_score <= 100)),
  add column if not exists call_priority_tier text
    check (call_priority_tier is null or call_priority_tier in ('low', 'medium', 'high', 'critical')),
  add column if not exists call_priority_computed_at timestamptz,
  add column if not exists call_priority_override int
    check (call_priority_override is null or (call_priority_override >= 0 and call_priority_override <= 100)),
  add column if not exists last_human_touch_at timestamptz;

create index if not exists idx_growth_leads_call_priority_queue
  on growth.leads (call_priority_score desc nulls last, last_researched_at desc nulls last)
  where status not in ('converted', 'disqualified', 'archived');

create index if not exists idx_growth_leads_follow_up_at
  on growth.leads (follow_up_at)
  where call_disposition = 'follow_up_later' and follow_up_at is not null;

-- -----------------------------------------------------------------------------
-- growth.lead_call_events — append-only call log
-- -----------------------------------------------------------------------------

create table if not exists growth.lead_call_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references growth.leads (id) on delete cascade,
  disposition text not null
    check (disposition in (
      'call_attempted', 'left_voicemail', 'interested', 'not_a_fit', 'follow_up_later'
    )),
  note text,
  follow_up_at timestamptz,
  call_priority_score int
    check (call_priority_score is null or (call_priority_score >= 0 and call_priority_score <= 100)),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_lead_call_events_lead_created
  on growth.lead_call_events (lead_id, created_at desc);

comment on table growth.lead_call_events is
  'Append-only internal call disposition log for Growth Engine leads (slice 3A).';

revoke all on table growth.lead_call_events from public, anon, authenticated;
grant select, insert, update, delete on table growth.lead_call_events to service_role;

alter table growth.lead_call_events enable row level security;
alter table growth.lead_call_events force row level security;
