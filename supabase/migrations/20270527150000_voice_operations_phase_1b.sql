-- Voice Operations Layer — Phase 1B
-- Conversations, routing profiles, business hours, voicemail boxes, number operations.

do $$
begin
  if to_regnamespace('voice') is null then
    raise exception 'Missing dependency: voice schema (apply 20270527140000 first)';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'voice' and t.typname = 'voice_conversation_status') then
    create type voice.voice_conversation_status as enum ('active', 'closed', 'archived');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'voice' and t.typname = 'voice_routing_mode') then
    create type voice.voice_routing_mode as enum (
      'forward_to_number',
      'assigned_user',
      'round_robin',
      'simultaneous_ring',
      'voicemail_only',
      'ai_receptionist_future'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Voicemail boxes (before routing profiles — referenced by profiles)
-- ---------------------------------------------------------------------------

create table if not exists voice.voice_voicemail_boxes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  greeting_text text not null default '',
  greeting_recording_path text,
  notification_email text not null default '',
  assigned_user_id uuid references auth.users (id) on delete set null,
  retention_days int not null default 30 check (retention_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table voice.voice_voicemail_boxes is 'Inbound voicemail box scaffolding (no AI or ringless drops).';

create index if not exists idx_voice_voicemail_boxes_org
  on voice.voice_voicemail_boxes (organization_id, name);

-- ---------------------------------------------------------------------------
-- Business hours
-- ---------------------------------------------------------------------------

create table if not exists voice.voice_business_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  timezone text not null default 'America/New_York',
  weekly_schedule_json jsonb not null default '{}'::jsonb,
  holiday_rules_json jsonb not null default '[]'::jsonb,
  after_hours_routing_mode voice.voice_routing_mode not null default 'voicemail_only',
  after_hours_forwarding_number text not null default '',
  after_hours_voicemail_box_id uuid references voice.voice_voicemail_boxes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table voice.voice_business_hours is 'Deterministic business hours for voice routing.';

create index if not exists idx_voice_business_hours_org
  on voice.voice_business_hours (organization_id, name);

-- ---------------------------------------------------------------------------
-- Routing profiles
-- ---------------------------------------------------------------------------

create table if not exists voice.voice_routing_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text not null default '',
  routing_mode voice.voice_routing_mode not null default 'assigned_user',
  fallback_mode voice.voice_routing_mode not null default 'voicemail_only',
  fallback_phone_number text not null default '',
  voicemail_box_id uuid references voice.voice_voicemail_boxes (id) on delete set null,
  business_hours_id uuid references voice.voice_business_hours (id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table voice.voice_routing_profiles is 'Inbound routing behavior profiles (planning layer only in Phase 1B).';

create index if not exists idx_voice_routing_profiles_org
  on voice.voice_routing_profiles (organization_id, name);

create table if not exists voice.voice_routing_profile_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  routing_profile_id uuid not null references voice.voice_routing_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  priority int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voice_routing_profile_members_unique unique (routing_profile_id, user_id)
);

comment on table voice.voice_routing_profile_members is 'Users eligible for round-robin / simultaneous ring routing.';

create index if not exists idx_voice_routing_profile_members_profile
  on voice.voice_routing_profile_members (routing_profile_id, priority asc, is_active);

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------

create table if not exists voice.voice_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  primary_phone_number text not null,
  contact_name text not null default '',
  related_customer_id uuid,
  related_prospect_id uuid,
  related_opportunity_id uuid,
  status voice.voice_conversation_status not null default 'active',
  last_activity_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voice_conversations_org_phone_unique unique (organization_id, primary_phone_number)
);

comment on table voice.voice_conversations is 'Multi-channel conversation foundation (calls/SMS/AI future).';

create index if not exists idx_voice_conversations_org_activity
  on voice.voice_conversations (organization_id, last_activity_at desc);

-- ---------------------------------------------------------------------------
-- Extend voice_numbers + voice_calls
-- ---------------------------------------------------------------------------

alter table voice.voice_numbers
  add column if not exists routing_profile_id uuid references voice.voice_routing_profiles (id) on delete set null,
  add column if not exists routing_mode voice.voice_routing_mode,
  add column if not exists default_forwarding_target text not null default '';

comment on column voice.voice_numbers.routing_mode is 'Optional per-number routing override.';

alter table voice.voice_calls
  add column if not exists voice_conversation_id uuid references voice.voice_conversations (id) on delete set null;

create index if not exists idx_voice_calls_conversation
  on voice.voice_calls (voice_conversation_id, started_at desc nulls last);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_voice_voicemail_boxes_set_updated_at on voice.voice_voicemail_boxes;
    create trigger trg_voice_voicemail_boxes_set_updated_at
      before update on voice.voice_voicemail_boxes
      for each row execute function public.set_updated_at();

    drop trigger if exists trg_voice_business_hours_set_updated_at on voice.voice_business_hours;
    create trigger trg_voice_business_hours_set_updated_at
      before update on voice.voice_business_hours
      for each row execute function public.set_updated_at();

    drop trigger if exists trg_voice_routing_profiles_set_updated_at on voice.voice_routing_profiles;
    create trigger trg_voice_routing_profiles_set_updated_at
      before update on voice.voice_routing_profiles
      for each row execute function public.set_updated_at();

    drop trigger if exists trg_voice_routing_profile_members_set_updated_at on voice.voice_routing_profile_members;
    create trigger trg_voice_routing_profile_members_set_updated_at
      before update on voice.voice_routing_profile_members
      for each row execute function public.set_updated_at();

    drop trigger if exists trg_voice_conversations_set_updated_at on voice.voice_conversations;
    create trigger trg_voice_conversations_set_updated_at
      before update on voice.voice_conversations
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table voice.voice_voicemail_boxes enable row level security;
alter table voice.voice_voicemail_boxes force row level security;
alter table voice.voice_business_hours enable row level security;
alter table voice.voice_business_hours force row level security;
alter table voice.voice_routing_profiles enable row level security;
alter table voice.voice_routing_profiles force row level security;
alter table voice.voice_routing_profile_members enable row level security;
alter table voice.voice_routing_profile_members force row level security;
alter table voice.voice_conversations enable row level security;
alter table voice.voice_conversations force row level security;

grant select on table voice.voice_voicemail_boxes to authenticated;
grant select, insert, update, delete on table voice.voice_voicemail_boxes to service_role;

grant select on table voice.voice_business_hours to authenticated;
grant select, insert, update, delete on table voice.voice_business_hours to service_role;

grant select on table voice.voice_routing_profiles to authenticated;
grant select, insert, update, delete on table voice.voice_routing_profiles to service_role;

grant select on table voice.voice_routing_profile_members to authenticated;
grant select, insert, update, delete on table voice.voice_routing_profile_members to service_role;

grant select on table voice.voice_conversations to authenticated;
grant select, insert, update on table voice.voice_conversations to service_role;

drop policy if exists "voice_voicemail_boxes_select_roles" on voice.voice_voicemail_boxes;
create policy "voice_voicemail_boxes_select_roles"
on voice.voice_voicemail_boxes for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "voice_business_hours_select_roles" on voice.voice_business_hours;
create policy "voice_business_hours_select_roles"
on voice.voice_business_hours for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "voice_routing_profiles_select_roles" on voice.voice_routing_profiles;
create policy "voice_routing_profiles_select_roles"
on voice.voice_routing_profiles for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "voice_routing_profile_members_select_roles" on voice.voice_routing_profile_members;
create policy "voice_routing_profile_members_select_roles"
on voice.voice_routing_profile_members for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));

drop policy if exists "voice_conversations_select_roles" on voice.voice_conversations;
create policy "voice_conversations_select_roles"
on voice.voice_conversations for select to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));
