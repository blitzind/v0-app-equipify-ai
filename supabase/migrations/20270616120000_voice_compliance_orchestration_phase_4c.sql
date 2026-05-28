-- Phase 4C — Compliance + consent orchestration.
-- Conservative by default: suppress or manual review when uncertain. No autonomous compliance decisions.

do $$
begin
  if to_regclass('voice.voice_opt_outs') is null then
    raise exception 'Missing dependency: voice.voice_opt_outs (apply voice foundation first)';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_consent_channel'
  ) then
    create type voice.voice_consent_channel as enum (
      'voice_call',
      'sms',
      'voicemail',
      'ringless_voicemail',
      'email',
      'ai_receptionist',
      'callback'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_consent_status'
  ) then
    create type voice.voice_consent_status as enum (
      'unknown',
      'granted',
      'denied',
      'revoked',
      'expired',
      'manual_review_required'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_suppression_type'
  ) then
    create type voice.voice_suppression_type as enum (
      'opt_out',
      'dnc',
      'complaint',
      'invalid_number',
      'high_frequency',
      'outside_call_hours',
      'consent_unknown',
      'manual_review',
      'relationship_suppression',
      'legal_hold',
      'provider_reputation'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_dnc_scope'
  ) then
    create type voice.voice_dnc_scope as enum (
      'organization',
      'global',
      'campaign',
      'relationship'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_compliance_decision'
  ) then
    create type voice.voice_compliance_decision as enum (
      'allowed',
      'blocked',
      'manual_review_required'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_compliance_audit_action'
  ) then
    create type voice.voice_compliance_audit_action as enum (
      'consent_captured',
      'consent_revoked',
      'suppression_added',
      'suppression_expired',
      'compliance_evaluated',
      'send_blocked',
      'manual_review_required',
      'campaign_approved',
      'campaign_rejected',
      'opt_out_propagated',
      'manual_review_approved',
      'manual_review_rejected',
      'consent_granted',
      'consent_denied'
    );
  end if;
end;
$$;

create table if not exists voice.voice_consent_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  related_customer_id uuid,
  related_prospect_id uuid,
  relationship_memory_profile_id uuid references voice.voice_relationship_memory_profiles (id) on delete set null,
  phone_number text not null,
  consent_channel voice.voice_consent_channel not null,
  consent_status voice.voice_consent_status not null default 'unknown',
  consent_source text not null default 'operator',
  evidence_text text not null default '',
  captured_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table voice.voice_consent_records is
  'Relationship/contact consent tracking — evidence-backed, operator-controlled.';

create index if not exists idx_voice_consent_records_org_phone_channel
  on voice.voice_consent_records (organization_id, phone_number, consent_channel);

create table if not exists voice.voice_suppression_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  phone_number text not null,
  suppression_type voice.voice_suppression_type not null,
  suppression_reason text not null default '',
  source text not null default 'system',
  severity text not null default 'high',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb
);

comment on table voice.voice_suppression_entries is
  'Suppression registry beyond opt-outs — auditable, time-bounded.';

create index if not exists idx_voice_suppression_entries_org_phone
  on voice.voice_suppression_entries (organization_id, phone_number, starts_at desc);

create table if not exists voice.voice_dnc_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  phone_number text not null,
  source text not null default 'operator',
  scope voice.voice_dnc_scope not null default 'organization',
  reason text not null default '',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table voice.voice_dnc_entries is
  'Organization DNC registry — scaffold only, no external paid provider integration.';

create index if not exists idx_voice_dnc_entries_org_phone
  on voice.voice_dnc_entries (organization_id, phone_number, scope);

create table if not exists voice.voice_call_hour_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  timezone text not null default 'America/New_York',
  allowed_days_json jsonb not null default '["monday","tuesday","wednesday","thursday","friday"]'::jsonb,
  allowed_start_time time not null default '09:00',
  allowed_end_time time not null default '17:00',
  channel voice.voice_consent_channel,
  campaign_type text,
  is_default boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table voice.voice_call_hour_rules is
  'Timezone-aware call-hour rules — conservative when timezone unknown.';

create index if not exists idx_voice_call_hour_rules_org_default
  on voice.voice_call_hour_rules (organization_id, is_default);

create table if not exists voice.voice_compliance_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  phone_number text,
  channel voice.voice_consent_channel,
  action voice.voice_compliance_audit_action not null,
  decision voice.voice_compliance_decision,
  evidence_json jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

comment on table voice.voice_compliance_audit_events is
  'Append-only compliance audit timeline — evidence-linked.';

create index if not exists idx_voice_compliance_audit_events_org_created
  on voice.voice_compliance_audit_events (organization_id, created_at desc);

alter table voice.voice_drop_recipients
  add column if not exists compliance_decision voice.voice_compliance_decision,
  add column if not exists compliance_reasons_json jsonb not null default '[]'::jsonb,
  add column if not exists manual_review_required boolean not null default false;

alter table voice.voice_consent_records enable row level security;
alter table voice.voice_suppression_entries enable row level security;
alter table voice.voice_dnc_entries enable row level security;
alter table voice.voice_call_hour_rules enable row level security;
alter table voice.voice_compliance_audit_events enable row level security;

create policy voice_consent_records_select on voice.voice_consent_records
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_suppression_entries_select on voice.voice_suppression_entries
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_dnc_entries_select on voice.voice_dnc_entries
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_call_hour_rules_select on voice.voice_call_hour_rules
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

create policy voice_compliance_audit_events_select on voice.voice_compliance_audit_events
  for select to authenticated
  using (organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid()));

grant select, insert, update, delete on voice.voice_consent_records to service_role;
grant select, insert, update, delete on voice.voice_suppression_entries to service_role;
grant select, insert, update, delete on voice.voice_dnc_entries to service_role;
grant select, insert, update, delete on voice.voice_call_hour_rules to service_role;
grant select, insert on voice.voice_compliance_audit_events to service_role;
