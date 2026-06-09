-- Growth Engine Apollo-Primary-2 — operator review audit trail for Apollo-acquired contacts.
-- Approval/rejection only — no auto-enrollment or outbound side effects.

do $$
begin
  if to_regclass('growth.company_contacts') is null then
    raise exception 'Missing dependency: growth.company_contacts';
  end if;
  if to_regclass('growth.contact_candidates') is null then
    raise exception 'Missing dependency: growth.contact_candidates';
  end if;
end;
$$;

create table if not exists growth.apollo_primary_contact_operator_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  company_candidate_id uuid not null,
  company_contact_id uuid references growth.company_contacts (id) on delete set null,
  contact_candidate_id uuid references growth.contact_candidates (id) on delete set null,

  action text not null
    check (action in ('approve', 'reject', 'bulk_approve')),

  operator_review_status text not null
    check (operator_review_status in ('approved', 'rejected')),

  reviewer_user_id uuid,
  reviewer_email text,

  contact_snapshot jsonb not null default '{}'::jsonb,
  sequence_ready_at_action boolean not null default false,
  blockers_at_action jsonb not null default '[]'::jsonb,
  note text,

  auto_enrollment_attempted boolean not null default false,
  outreach_sent boolean not null default false,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists apollo_primary_contact_operator_reviews_company_idx
  on growth.apollo_primary_contact_operator_reviews (company_candidate_id, created_at desc);

create index if not exists apollo_primary_contact_operator_reviews_contact_idx
  on growth.apollo_primary_contact_operator_reviews (company_contact_id, created_at desc);

revoke all on table growth.apollo_primary_contact_operator_reviews from public, anon, authenticated;
grant select, insert, update, delete on table growth.apollo_primary_contact_operator_reviews to service_role;
alter table growth.apollo_primary_contact_operator_reviews enable row level security;

comment on table growth.apollo_primary_contact_operator_reviews is
  'Apollo-Primary-2 operator approval/rejection audit trail. Marks outreach readiness only — no enrollment or outbound.';
