-- FUZOR-COMPANY-INTELLIGENCE-2A — Append-only GPT Company Intelligence versions.
-- Layer 2 understanding only. Never stores raw evidence bodies or AI-employee reasoning.
-- Justified: existing 7.6A tables are deterministic evidence/snapshots and overwrite;
-- versioned GPT understanding requires insert-only history with first-class model metadata.
-- PLATFORM-LIFT-1A adds owner_organization_id / ai_deployment_id via
-- 20270902120000_fuzor_company_intelligence_owner_org_lift_1a.sql.

do $$
begin
  if to_regclass('growth.companies') is null then
    raise exception 'Missing dependency: growth.companies';
  end if;
end;
$$;

create table if not exists growth.fuzor_company_intelligence_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Canonical company when resolved; lead_id always retained for provenance.
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

  -- Layer 2 understanding document (no Equipify / ICP / sales reasoning).
  understanding jsonb not null,

  -- Source references only — never duplicate full raw evidence payloads.
  evidence_refs jsonb not null default '[]'::jsonb,

  generation_metadata jsonb not null default '{}'::jsonb,
  generation_duration_ms integer,
  prompt_tokens integer,
  completion_tokens integer,

  qa_marker text not null,
  generation_mode text not null
);

create index if not exists fuzor_company_intelligence_versions_company_created_idx
  on growth.fuzor_company_intelligence_versions (company_id, created_at desc);

create index if not exists fuzor_company_intelligence_versions_lead_created_idx
  on growth.fuzor_company_intelligence_versions (lead_id, created_at desc);

create index if not exists fuzor_company_intelligence_versions_fingerprint_idx
  on growth.fuzor_company_intelligence_versions (evidence_fingerprint);

comment on table growth.fuzor_company_intelligence_versions is
  'FUZOR-COMPANY-INTELLIGENCE-2A append-only GPT business understanding versions. Layer 2 only.';

revoke all on table growth.fuzor_company_intelligence_versions from public, anon, authenticated;
grant select, insert on table growth.fuzor_company_intelligence_versions to service_role;
-- No update/delete grants: versions are immutable history.

alter table growth.fuzor_company_intelligence_versions enable row level security;
