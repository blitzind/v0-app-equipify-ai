-- AI Operational Assistant Phase 4 — Slack/Teams delivery + ranking telemetry.
--
-- Adds explicit enable toggles for the Slack and Teams destinations
-- (URL presence alone isn't enough — managers want to disable a
-- destination without losing the saved webhook), and a
-- per-destination result column on the runs table so the settings
-- UI can surface "email sent, Slack failed" granularity.
--
-- Strictly additive + idempotent.

alter table public.ai_ops_digest_settings
  add column if not exists slack_enabled boolean not null default false;

alter table public.ai_ops_digest_settings
  add column if not exists teams_enabled boolean not null default false;

comment on column public.ai_ops_digest_settings.slack_enabled is
  'AI Ops Phase 4 — when true and slack_webhook_url is present, the digest is also POSTed to Slack as an internal Block Kit message.';

comment on column public.ai_ops_digest_settings.teams_enabled is
  'AI Ops Phase 4 — when true and teams_webhook_url is present, the digest is also POSTed to Teams as an internal Adaptive Card.';

-- -----------------------------------------------------------------------------
-- ai_ops_digest_runs.destinations_result
-- -----------------------------------------------------------------------------
-- Shape:
--   {
--     "email":  { "status": "sent" | "failed" | "skipped", "messageId": string|null,
--                  "errorCode": string|null, "errorMessage": string|null,
--                  "recipientCount": number },
--     "slack":  { "status": "sent" | "failed" | "skipped" | "disabled",
--                  "errorCode": string|null, "errorMessage": string|null },
--     "teams":  { "status": "sent" | "failed" | "skipped" | "disabled",
--                  "errorCode": string|null, "errorMessage": string|null }
--   }
-- We never store webhook URLs, secrets, or provider payloads.
alter table public.ai_ops_digest_runs
  add column if not exists destinations_result jsonb not null default '{}'::jsonb;

comment on column public.ai_ops_digest_runs.destinations_result is
  'AI Ops Phase 4 — per-destination delivery result. {email,slack,teams} → {status,errorCode,errorMessage,...}. Never contains webhook URLs or provider secrets.';
