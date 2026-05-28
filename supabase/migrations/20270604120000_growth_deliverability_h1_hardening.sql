-- Growth Engine H1 — Deliverability & Send Safety Hardening
-- Persistent sender pause state, reputation snapshot trends, operational audit fields.

do $$
begin
  if to_regclass('growth.sender_accounts') is null then
    raise exception 'Missing dependency: growth.sender_accounts';
  end if;
  if to_regclass('growth.mailbox_reputation_snapshots') is null then
    raise exception 'Missing dependency: growth.mailbox_reputation_snapshots';
  end if;
end $$;

alter table growth.sender_accounts
  add column if not exists deliverability_pause_reason text,
  add column if not exists deliverability_paused_at timestamptz,
  add column if not exists deliverability_pause_rule_id text,
  add column if not exists deliverability_cooldown_until timestamptz,
  add column if not exists deliverability_recovery_at timestamptz,
  add column if not exists deliverability_operator_override_reason text,
  add column if not exists deliverability_operator_override_at timestamptz;

create index if not exists idx_growth_sender_accounts_deliverability_paused
  on growth.sender_accounts (deliverability_paused_at desc)
  where deleted_at is null and deliverability_paused_at is not null;

alter table growth.mailbox_reputation_snapshots
  add column if not exists risk_score_delta integer,
  add column if not exists previous_health_tier text,
  add column if not exists health_tier_changed boolean not null default false;

comment on column growth.sender_accounts.deliverability_paused_at is
  'Persistent deliverability pause — enforced pre-send until recovery or operator override.';

comment on column growth.mailbox_reputation_snapshots.risk_score_delta is
  'Day-over-day risk score change from prior snapshot — cron rollup only.';
