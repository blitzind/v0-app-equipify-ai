-- Voice Call Control Foundation — Phase 1C
-- Recording policy, call-control settings, voicemail recording metadata.

do $$
begin
  if to_regnamespace('voice') is null then
    raise exception 'Missing dependency: voice schema';
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'voice' and t.typname = 'voice_recording_policy_kind') then
    create type voice.voice_recording_policy_kind as enum (
      'disabled',
      'inbound_only',
      'outbound_only',
      'all_calls'
    );
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'voice' and t.typname = 'voice_recording_kind') then
    create type voice.voice_recording_kind as enum ('call', 'voicemail');
  end if;
end;
$$;

create table if not exists voice.voice_call_control_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  default_recording_policy voice.voice_recording_policy_kind not null default 'disabled',
  recording_disclosure_text text not null default 'This call may be recorded for quality assurance.',
  inbound_call_control_ready boolean not null default false,
  voicemail_callback_ready boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table voice.voice_call_control_settings is
  'Org-level call control and recording policy scaffolding (Phase 1C).';

alter table voice.voice_numbers
  add column if not exists recording_policy voice.voice_recording_policy_kind;

comment on column voice.voice_numbers.recording_policy is
  'Optional per-number recording policy override.';

alter table voice.voice_routing_profile_members
  add column if not exists forwarding_phone_number text not null default '';

alter table voice.voice_recordings
  add column if not exists recording_kind voice.voice_recording_kind not null default 'call',
  add column if not exists voicemail_box_id uuid references voice.voice_voicemail_boxes (id) on delete set null;

alter table voice.voice_recordings
  alter column voice_call_id drop not null;

create index if not exists idx_voice_recordings_voicemail_box
  on voice.voice_recordings (voicemail_box_id, created_at desc)
  where voicemail_box_id is not null;

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_voice_call_control_settings_set_updated_at on voice.voice_call_control_settings;
    create trigger trg_voice_call_control_settings_set_updated_at
      before update on voice.voice_call_control_settings
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

alter table voice.voice_call_control_settings enable row level security;
alter table voice.voice_call_control_settings force row level security;

grant select on table voice.voice_call_control_settings to authenticated;
grant select, insert, update on table voice.voice_call_control_settings to service_role;

drop policy if exists "voice_call_control_settings_select_roles" on voice.voice_call_control_settings;
create policy "voice_call_control_settings_select_roles"
on voice.voice_call_control_settings
for select
to authenticated
using (public.has_org_role (organization_id, array['owner', 'admin', 'manager']));
