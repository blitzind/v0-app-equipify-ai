-- Growth Engine Apollo-Primary-3 — enrollment approval queue bridge.
-- Handoff from operator review to enrollment eligibility only — no auto-enrollment or outbound.

do $$
begin
  if to_regclass('growth.apollo_primary_contact_operator_reviews') is null then
    raise exception 'Missing dependency: growth.apollo_primary_contact_operator_reviews';
  end if;
end;
$$;

create table if not exists growth.apollo_primary_contact_enrollment_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  company_candidate_id uuid not null,
  company_contact_id uuid references growth.company_contacts (id) on delete set null,
  contact_candidate_id uuid references growth.contact_candidates (id) on delete set null,
  operator_review_id uuid references growth.apollo_primary_contact_operator_reviews (id) on delete set null,

  status text not null default 'pending_enrollment_approval'
    check (status in ('pending_enrollment_approval', 'enrollment_approved', 'enrollment_rejected')),

  contact_snapshot jsonb not null default '{}'::jsonb,
  sequence_ready_at_handoff boolean not null default false,
  blockers_at_handoff jsonb not null default '[]'::jsonb,

  enrollment_approved_at timestamptz,
  enrollment_approved_by uuid,
  enrollment_approved_email text,
  enrollment_rejection_note text,

  auto_enrollment_attempted boolean not null default false,
  outreach_sent boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists apollo_primary_contact_enrollment_queue_status_idx
  on growth.apollo_primary_contact_enrollment_queue (status, created_at desc);

create index if not exists apollo_primary_contact_enrollment_queue_company_idx
  on growth.apollo_primary_contact_enrollment_queue (company_candidate_id, created_at desc);

create unique index if not exists apollo_primary_contact_enrollment_queue_contact_unique
  on growth.apollo_primary_contact_enrollment_queue (company_contact_id)
  where company_contact_id is not null and status = 'pending_enrollment_approval';

create unique index if not exists apollo_primary_contact_enrollment_queue_candidate_unique
  on growth.apollo_primary_contact_enrollment_queue (contact_candidate_id)
  where contact_candidate_id is not null and status = 'pending_enrollment_approval';

create table if not exists growth.apollo_primary_contact_enrollment_handoffs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  queue_item_id uuid not null references growth.apollo_primary_contact_enrollment_queue (id) on delete cascade,
  operator_review_id uuid references growth.apollo_primary_contact_operator_reviews (id) on delete set null,

  company_candidate_id uuid not null,
  company_contact_id uuid,
  contact_candidate_id uuid,

  handoff_reason text not null default 'operator_review_approved',
  contact_snapshot jsonb not null default '{}'::jsonb,
  sequence_ready_at_handoff boolean not null default false,
  blockers_at_handoff jsonb not null default '[]'::jsonb,

  auto_enrollment_attempted boolean not null default false,
  outreach_sent boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists apollo_primary_contact_enrollment_handoffs_queue_idx
  on growth.apollo_primary_contact_enrollment_handoffs (queue_item_id, created_at desc);

revoke all on table growth.apollo_primary_contact_enrollment_queue from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_primary_contact_enrollment_queue to service_role;
alter table growth.apollo_primary_contact_enrollment_queue enable row level security;

revoke all on table growth.apollo_primary_contact_enrollment_handoffs from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_primary_contact_enrollment_handoffs to service_role;
alter table growth.apollo_primary_contact_enrollment_handoffs enable row level security;

comment on table growth.apollo_primary_contact_enrollment_queue is
  'Apollo-Primary-3 enrollment approval queue. Approved contacts await explicit enrollment approval — no auto-enroll or outbound.';

comment on table growth.apollo_primary_contact_enrollment_handoffs is
  'Apollo-Primary-3 handoff evidence from operator review to enrollment approval queue.';
