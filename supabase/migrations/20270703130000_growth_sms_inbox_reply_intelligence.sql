-- Growth Engine Phase 5.2 — SMS inbox + reply intelligence foundation.
-- Platform SMS reply connection for canonical outbound_replies ingestion.

do $$
begin
  if to_regclass('growth.email_provider_connections') is null then
    raise exception 'Missing dependency: growth.email_provider_connections';
  end if;
  if to_regclass('growth.sms_workspace_settings') is null then
    raise exception 'Missing dependency: growth.sms_workspace_settings';
  end if;
end;
$$;

insert into growth.email_provider_connections (
  id,
  provider,
  provider_family,
  label,
  status,
  config
)
values (
  '00000000-0000-4000-8000-000000005502'::uuid,
  'twilio_sms',
  'custom',
  'Growth SMS (Twilio)',
  'active',
  '{"channel":"sms","from_e164":"+18333784743","phase":"5.2"}'::jsonb
)
on conflict (id) do nothing;

update growth.sms_workspace_settings
set metadata = coalesce(metadata, '{}'::jsonb) || '{"reply_connection_id":"00000000-0000-4000-8000-000000005502"}'::jsonb,
    updated_at = now()
where id = '00000000-0000-4000-8000-000000005501'::uuid;

comment on table growth.email_provider_connections is
  'Outbound provider connections — includes platform Growth SMS (twilio_sms) for reply intelligence.';
