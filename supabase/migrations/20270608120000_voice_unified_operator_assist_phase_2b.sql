-- Phase 2B — Unified operator assist lifecycle + per-operator preferences.

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_intelligence_event_status' and e.enumlabel = 'resolved'
  ) then
    alter type voice.voice_intelligence_event_status add value 'resolved';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_intelligence_event_status' and e.enumlabel = 'expired'
  ) then
    alter type voice.voice_intelligence_event_status add value 'expired';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'voice' and t.typname = 'voice_intelligence_event_status' and e.enumlabel = 'escalated'
  ) then
    alter type voice.voice_intelligence_event_status add value 'escalated';
  end if;
end;
$$;

create table if not exists growth.operator_assist_preferences (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  quiet_mode boolean not null default false,
  minimum_priority_label text not null default 'Low',
  enabled_categories jsonb not null default '{"objection":true,"buying_signal":true,"risk":true,"guidance":true,"coaching":true,"interruption":true,"conversation":true}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table growth.operator_assist_preferences enable row level security;

create policy operator_assist_preferences_select on growth.operator_assist_preferences
  for select to authenticated
  using (
    organization_id in (
      select om.organization_id from public.organization_members om
      where om.user_id = auth.uid()
    )
  );

create policy operator_assist_preferences_update on growth.operator_assist_preferences
  for all to authenticated
  using (
    user_id = auth.uid()
    and organization_id in (
      select om.organization_id from public.organization_members om
      where om.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and organization_id in (
      select om.organization_id from public.organization_members om
      where om.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on growth.operator_assist_preferences to service_role;
