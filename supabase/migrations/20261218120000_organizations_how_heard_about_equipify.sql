-- Self-serve signup attribution: how the workspace creator heard about Equipify.

alter table public.organizations
  add column if not exists how_heard_about_equipify text,
  add column if not exists how_heard_about_equipify_other text;

comment on column public.organizations.how_heard_about_equipify is
  'Canonical slug from onboarding (e.g. google_search, referral, other). Optional.';
comment on column public.organizations.how_heard_about_equipify_other is
  'Free-text detail when how_heard_about_equipify = other. Optional otherwise.';

create index if not exists idx_organizations_how_heard_about_equipify
  on public.organizations (how_heard_about_equipify)
  where how_heard_about_equipify is not null;
