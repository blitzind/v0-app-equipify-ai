-- Idempotent repair: native dialer Google Voice bridge CHECK constraints.
-- Safe when 20270315130000 was skipped, partially applied, or schema drifted.

alter table growth.native_dialer_settings
  drop constraint if exists native_dialer_settings_primary_provider_check;

alter table growth.native_dialer_settings
  add constraint native_dialer_settings_primary_provider_check
  check (primary_provider in (
    'stub',
    'retell',
    'twilio',
    'elevenlabs_conversational',
    'sip',
    'google_voice_bridge'
  ));

alter table growth.native_dialer_settings
  drop constraint if exists native_dialer_settings_fallback_provider_check;

alter table growth.native_dialer_settings
  add constraint native_dialer_settings_fallback_provider_check
  check (fallback_provider in (
    'stub',
    'retell',
    'twilio',
    'elevenlabs_conversational',
    'sip',
    'google_voice_bridge'
  ));

alter table growth.native_call_workspace_sessions
  drop constraint if exists native_call_workspace_sessions_status_check;

alter table growth.native_call_workspace_sessions
  add constraint native_call_workspace_sessions_status_check
  check (status in (
    'ringing',
    'external_bridge_pending',
    'active',
    'on_hold',
    'wrapping',
    'completed',
    'declined',
    'failed',
    'missed',
    'no_answer'
  ));
