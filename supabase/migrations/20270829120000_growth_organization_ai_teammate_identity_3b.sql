-- GE-AI-UX-3B — Organization-scoped AI teammate name + per-user onboarding flag.

create table if not exists growth.organization_ai_teammate_identity (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  teammate_name text not null default 'Ava',
  updated_by_user_id uuid references auth.users (id) on delete set null,
  qa_marker text not null default 'ge-ai-ux-3b-ai-teammate-server-identity-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_ai_teammate_name_length check (char_length(trim(teammate_name)) between 2 and 32),
  constraint organization_ai_teammate_name_pattern check (
    teammate_name ~ '^[[:alpha:]0-9][[:alpha:]0-9'' -]*[[:alpha:]0-9]$|^[[:alpha:]0-9]$'
  )
);

comment on table growth.organization_ai_teammate_identity is
  'Organization-scoped AI OS teammate display name (GE-AI-UX-3B). Role remains system-controlled in app layer.';

create index if not exists idx_growth_organization_ai_teammate_identity_org
  on growth.organization_ai_teammate_identity (organization_id);

drop trigger if exists trg_growth_organization_ai_teammate_identity_set_updated_at
  on growth.organization_ai_teammate_identity;
create trigger trg_growth_organization_ai_teammate_identity_set_updated_at
before update on growth.organization_ai_teammate_identity
for each row execute function public.set_updated_at();

revoke all on table growth.organization_ai_teammate_identity from public, anon, authenticated;
grant select, insert, update, delete on table growth.organization_ai_teammate_identity to service_role;

alter table growth.organization_ai_teammate_identity enable row level security;
alter table growth.organization_ai_teammate_identity force row level security;

create policy growth_organization_ai_teammate_identity_service_role
  on growth.organization_ai_teammate_identity for all to service_role using (true) with check (true);

alter table growth.operator_workspace_preferences
  add column if not exists ai_teammate_onboarding_completed boolean not null default false;

comment on column growth.operator_workspace_preferences.ai_teammate_onboarding_completed is
  'Per-user AI teammate onboarding completion flag (GE-AI-UX-3B).';
