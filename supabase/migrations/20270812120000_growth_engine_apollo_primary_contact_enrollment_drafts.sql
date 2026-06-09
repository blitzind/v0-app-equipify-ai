-- Growth Engine Apollo-Primary-4 — enrollment draft creation audit trail.
-- Draft-only handoff from enrollment approval queue — no confirm, auto-enrollment, or outbound.

do $$
begin
  if to_regclass('growth.apollo_primary_contact_enrollment_queue') is null then
    raise exception 'Missing dependency: growth.apollo_primary_contact_enrollment_queue';
  end if;
end;
$$;

create table if not exists growth.apollo_primary_contact_enrollment_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  queue_item_id uuid not null references growth.apollo_primary_contact_enrollment_queue (id) on delete cascade,
  company_candidate_id uuid not null,
  company_contact_id uuid references growth.company_contacts (id) on delete set null,

  growth_lead_id uuid,
  sequence_enrollment_id uuid,

  status text not null
    check (status in ('draft_created', 'blocked')),

  blockers jsonb not null default '[]'::jsonb,
  source_attribution jsonb not null default '[]'::jsonb,

  created_by uuid,
  created_by_email text,

  auto_enrollment_attempted boolean not null default false,
  outreach_sent boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists apollo_primary_contact_enrollment_drafts_queue_idx
  on growth.apollo_primary_contact_enrollment_drafts (queue_item_id, created_at desc);

create index if not exists apollo_primary_contact_enrollment_drafts_status_idx
  on growth.apollo_primary_contact_enrollment_drafts (status, created_at desc);

revoke all on table growth.apollo_primary_contact_enrollment_drafts from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_primary_contact_enrollment_drafts to service_role;
alter table growth.apollo_primary_contact_enrollment_drafts enable row level security;

comment on table growth.apollo_primary_contact_enrollment_drafts is
  'Apollo-Primary-4 enrollment draft audit trail. Records draft creation or blocked attempts — no confirm or outbound.';
