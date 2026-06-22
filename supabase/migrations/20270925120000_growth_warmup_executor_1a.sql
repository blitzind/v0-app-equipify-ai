-- GS-GROWTH-WARMUP-EXECUTOR-1A — Approved warmup recipients + send audit trail.
-- DO NOT APPLY until operator approves migration.

do $$
begin
  if to_regclass('growth.warmup_profiles') is null then
    raise exception 'Missing dependency: growth.warmup_profiles';
  end if;
  if to_regclass('growth.sender_accounts') is null then
    raise exception 'Missing dependency: growth.sender_accounts';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.warmup_recipients — explicitly approved first-party warmup contacts
-- -----------------------------------------------------------------------------

create table if not exists growth.warmup_recipients (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null default '',
  label text not null default '',
  recipient_type text not null default 'safe_contact'
    check (recipient_type in ('internal', 'colleague', 'customer', 'safe_contact', 'owned_inbox')),
  active boolean not null default true,
  approved boolean not null default false,
  max_emails_per_day integer not null default 3 check (max_emails_per_day >= 0),
  max_emails_per_week integer not null default 10 check (max_emails_per_week >= 0),
  last_sent_at timestamptz,
  notes text,
  qa_marker text not null default 'growth-warmup-executor-1a-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint warmup_recipients_email_unique unique (email)
);

create index if not exists idx_growth_warmup_recipients_active
  on growth.warmup_recipients (active, approved)
  where deleted_at is null;

comment on table growth.warmup_recipients is
  'GS-GROWTH-WARMUP-EXECUTOR-1A — operator-approved warmup recipients only. No peer network.';

-- -----------------------------------------------------------------------------
-- growth.warmup_send_runs — idempotent cron/manual executor batches
-- -----------------------------------------------------------------------------

create table if not exists growth.warmup_send_runs (
  id uuid primary key default gen_random_uuid(),
  run_kind text not null default 'cron'
    check (run_kind in ('cron', 'manual')),
  idempotency_key text not null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'partial', 'skipped', 'failed')),
  profiles_scanned integer not null default 0,
  sends_attempted integer not null default 0,
  sends_succeeded integer not null default 0,
  sends_failed integer not null default 0,
  sends_skipped integer not null default 0,
  skip_reasons jsonb not null default '[]'::jsonb,
  actor_email text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  qa_marker text not null default 'growth-warmup-executor-1a-v1',
  created_at timestamptz not null default now()
);

create unique index if not exists idx_growth_warmup_send_runs_idempotency
  on growth.warmup_send_runs (idempotency_key);

comment on table growth.warmup_send_runs is
  'GS-GROWTH-WARMUP-EXECUTOR-1A — executor batch audit (cron + manual).';

-- -----------------------------------------------------------------------------
-- growth.warmup_send_attempts — per-send audit rows
-- -----------------------------------------------------------------------------

create table if not exists growth.warmup_send_attempts (
  id uuid primary key default gen_random_uuid(),
  warmup_send_run_id uuid not null references growth.warmup_send_runs (id) on delete cascade,
  warmup_profile_id uuid not null references growth.warmup_profiles (id) on delete cascade,
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  warmup_recipient_id uuid references growth.warmup_recipients (id) on delete set null,
  recipient_email text not null,
  subject text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  skip_reason text,
  delivery_attempt_id uuid,
  template_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_growth_warmup_send_attempts_profile_day
  on growth.warmup_send_attempts (warmup_profile_id, created_at desc);

create index if not exists idx_growth_warmup_send_attempts_recipient
  on growth.warmup_send_attempts (warmup_recipient_id, created_at desc);

comment on table growth.warmup_send_attempts is
  'GS-GROWTH-WARMUP-EXECUTOR-1A — per warmup executor send attempt.';

revoke all on table growth.warmup_recipients from public, anon, authenticated;
revoke all on table growth.warmup_send_runs from public, anon, authenticated;
revoke all on table growth.warmup_send_attempts from public, anon, authenticated;

grant select, insert, update, delete on table growth.warmup_recipients to service_role;
grant select, insert, update, delete on table growth.warmup_send_runs to service_role;
grant select, insert, update, delete on table growth.warmup_send_attempts to service_role;

alter table growth.warmup_recipients enable row level security;
alter table growth.warmup_send_runs enable row level security;
alter table growth.warmup_send_attempts enable row level security;

alter table growth.warmup_recipients force row level security;
alter table growth.warmup_send_runs force row level security;
alter table growth.warmup_send_attempts force row level security;

create policy growth_warmup_recipients_service_role
  on growth.warmup_recipients for all to service_role using (true) with check (true);

create policy growth_warmup_send_runs_service_role
  on growth.warmup_send_runs for all to service_role using (true) with check (true);

create policy growth_warmup_send_attempts_service_role
  on growth.warmup_send_attempts for all to service_role using (true) with check (true);
