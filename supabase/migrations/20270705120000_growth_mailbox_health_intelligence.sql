-- Growth Engine Phase 6.31B — Mailbox health intelligence fields on reputation snapshots.

do $$
begin
  if to_regclass('growth.mailbox_reputation_snapshots') is null then
    raise exception 'Missing dependency: growth.mailbox_reputation_snapshots';
  end if;
end;
$$;

alter table growth.mailbox_reputation_snapshots
  add column if not exists health_score integer check (health_score >= 0 and health_score <= 100),
  add column if not exists health_state text
    check (health_state is null or health_state in ('healthy', 'warning', 'at_risk', 'critical', 'disabled')),
  add column if not exists delivery_success_rate numeric,
  add column if not exists throttle_status text
    check (throttle_status is null or throttle_status in ('ok', 'throttled', 'paused'));

-- Backfill from existing risk_score where present.
update growth.mailbox_reputation_snapshots
set
  health_score = coalesce(health_score, risk_score),
  health_state = coalesce(
    health_state,
    case health_tier
      when 'healthy' then 'healthy'
      when 'warming' then 'healthy'
      when 'caution' then 'warning'
      when 'protected' then 'at_risk'
      when 'high_risk' then 'at_risk'
      when 'paused' then 'critical'
      else 'warning'
    end
  )
where health_score is null or health_state is null;

create index if not exists mailbox_reputation_snapshots_health_state_idx
  on growth.mailbox_reputation_snapshots (health_state, snapshot_date desc);

comment on column growth.mailbox_reputation_snapshots.health_score is
  'Phase 6.31B mailbox health score 0–100 (higher is healthier).';
comment on column growth.mailbox_reputation_snapshots.health_state is
  'Phase 6.31B operator-facing health state.';
