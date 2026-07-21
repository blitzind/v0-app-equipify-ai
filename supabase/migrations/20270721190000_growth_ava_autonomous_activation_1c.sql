-- GE-AIOS-LAUNCH-1C — Ava one-time autonomous activation timestamp (operator employment history).

alter table growth.organization_ai_teammate_identity
  add column if not exists autonomous_activated_at timestamptz null,
  add column if not exists autonomous_activated_by_user_id uuid references auth.users (id) on delete set null;

comment on column growth.organization_ai_teammate_identity.autonomous_activated_at is
  'When the operator completed one-time Ava autonomous activation (GE-AIOS-LAUNCH-1C).';

comment on column growth.organization_ai_teammate_identity.autonomous_activated_by_user_id is
  'Operator who activated Ava autonomous mode (GE-AIOS-LAUNCH-1C).';
