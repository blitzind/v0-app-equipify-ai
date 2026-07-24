-- FUZOR-PLATFORM-LIFT-1A — Org-owned Company Intelligence.
-- Company Intelligence belongs to the organization operating the AI deployment.
-- Natural key: (owner_organization_id, external company / company_id).
-- Append-only history preserved. No data migration in this milestone.

do $$
begin
  if to_regclass('growth.fuzor_company_intelligence_versions') is null then
    -- Greenfield: create full platform table (includes ownership columns).
    create table growth.fuzor_company_intelligence_versions (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),

      -- Organization A: owns this intelligence (AI deployment operator).
      owner_organization_id uuid not null,

      -- Optional future: multiple deployments per org share CI; knowledge stays deployment-specific.
      ai_deployment_id uuid,

      -- Organization B / external company being understood.
      company_id uuid references growth.companies (id) on delete set null,
      lead_id uuid,

      company_name text not null,
      website text,

      model text not null,
      model_version text,
      prompt_version text not null,
      company_intelligence_version text not null,
      evidence_version text not null,
      evidence_fingerprint text not null,

      understanding jsonb not null,
      evidence_refs jsonb not null default '[]'::jsonb,

      generation_metadata jsonb not null default '{}'::jsonb,
      generation_duration_ms integer,
      prompt_tokens integer,
      completion_tokens integer,

      qa_marker text not null,
      generation_mode text not null
    );

    revoke all on table growth.fuzor_company_intelligence_versions from public, anon, authenticated;
    grant select, insert on table growth.fuzor_company_intelligence_versions to service_role;
    alter table growth.fuzor_company_intelligence_versions enable row level security;
  else
    -- Existing 2A table: add ownership columns.
    alter table growth.fuzor_company_intelligence_versions
      add column if not exists owner_organization_id uuid;

    alter table growth.fuzor_company_intelligence_versions
      add column if not exists ai_deployment_id uuid;

    -- Backfill null owners is intentionally not performed here (no data migration).
    -- New writes must always set owner_organization_id.
  end if;
end;
$$;

create index if not exists fuzor_ci_versions_owner_company_created_idx
  on growth.fuzor_company_intelligence_versions (owner_organization_id, company_id, created_at desc);

create index if not exists fuzor_ci_versions_owner_lead_created_idx
  on growth.fuzor_company_intelligence_versions (owner_organization_id, lead_id, created_at desc);

create index if not exists fuzor_ci_versions_owner_fingerprint_idx
  on growth.fuzor_company_intelligence_versions (owner_organization_id, evidence_fingerprint);

create index if not exists fuzor_ci_versions_owner_deployment_idx
  on growth.fuzor_company_intelligence_versions (owner_organization_id, ai_deployment_id, created_at desc);

comment on column growth.fuzor_company_intelligence_versions.owner_organization_id is
  'Organization A — operates the AI deployment and owns this Company Intelligence.';
comment on column growth.fuzor_company_intelligence_versions.ai_deployment_id is
  'Optional AI deployment id within the owner org. CI is shared across deployments; reserved for future.';
comment on column growth.fuzor_company_intelligence_versions.company_id is
  'External company (Organization B) being understood — not the owner org.';
