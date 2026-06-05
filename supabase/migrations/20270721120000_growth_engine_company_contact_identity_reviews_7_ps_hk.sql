-- Growth Engine Phase 7.PS-HK — Human identity evidence review audit trail.

do $$
begin
  if to_regclass('growth.company_contacts') is null then
    raise exception 'Missing dependency: growth.company_contacts';
  end if;
end;
$$;

alter table growth.company_contacts
  drop constraint if exists company_contacts_phone_status_check;

alter table growth.company_contacts
  add constraint company_contacts_phone_status_check
  check (phone_status in ('unknown', 'business', 'mobile', 'invalid', 'verified'));

create table if not exists growth.company_contact_identity_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  company_contact_id uuid not null references growth.company_contacts (id) on delete cascade,
  company_id uuid not null,
  canonical_person_id uuid references growth.persons (id) on delete set null,

  reviewer_user_id uuid,
  reviewer_email text,

  source_url text,
  evidence_snapshot jsonb not null default '[]'::jsonb,

  fields_changed text[] not null default '{}',
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,

  actions jsonb not null default '[]'::jsonb,
  review_note text,

  triggered_phone_discovery boolean not null default false,
  phone_discovery_run_id uuid references growth.phone_discovery_runs (id) on delete set null,
  phone_promoted_count int not null default 0 check (phone_promoted_count >= 0),

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists company_contact_identity_reviews_contact_idx
  on growth.company_contact_identity_reviews (company_contact_id, created_at desc);

create index if not exists company_contact_identity_reviews_company_idx
  on growth.company_contact_identity_reviews (company_id, created_at desc);

drop trigger if exists trg_growth_company_contact_identity_reviews_updated_at on growth.company_contact_identity_reviews;

revoke all on table growth.company_contact_identity_reviews from public, anon, authenticated;
grant select, insert, update, delete on table growth.company_contact_identity_reviews to service_role;
alter table growth.company_contact_identity_reviews enable row level security;

comment on table growth.company_contact_identity_reviews is
  'Operator human identity evidence reviews for company_contacts (7.PS-HK). Immutable audit trail per review action.';
