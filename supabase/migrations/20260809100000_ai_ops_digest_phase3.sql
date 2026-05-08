-- AI Operational Assistant Phase 3 — daily digest + internal alert foundation.
--
-- Two small additive tables. Settings are upsert-by-org; runs are
-- append-only history rows used by the digest history UI and by
-- future Slack/Teams alert implementations to reason about
-- last-sent timestamps and re-send cool-downs.
--
-- Both tables are nullable-friendly and idempotent. Nothing in the
-- existing schema is modified.

-- -----------------------------------------------------------------------------
-- ai_ops_digest_settings
-- -----------------------------------------------------------------------------

create table if not exists public.ai_ops_digest_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  recipients jsonb not null default '[]'::jsonb,           -- text[] of internal email addresses
  send_hour smallint not null default 7,                   -- local hour (0-23)
  /** Snapshot of org timezone at save time — fallback only;
      cron always re-reads `organizations.timezone` to honor live edits. */
  timezone_snapshot text,
  priority_threshold text not null default 'medium'        -- high | medium | low
    check (priority_threshold in ('high', 'medium', 'low')),
  categories jsonb not null default '[]'::jsonb,           -- empty = all visible
  /** Phase 3 ships email-only delivery. Slack/Teams webhook
      columns are reserved so future phases can add destinations
      without a follow-up migration. */
  slack_webhook_url text,
  teams_webhook_url text,
  /** Skip running on calendar weekends — convenience toggle. */
  skip_weekends boolean not null default false,
  last_sent_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_ops_digest_settings_enabled
  on public.ai_ops_digest_settings (enabled) where enabled = true;

comment on table public.ai_ops_digest_settings is
  'AI Ops Phase 3 — per-organization digest schedule + recipient configuration. Email-only delivery in Phase 3; Slack/Teams columns reserved for future use.';

revoke all on table public.ai_ops_digest_settings from public, anon;
grant select on table public.ai_ops_digest_settings to authenticated;

alter table public.ai_ops_digest_settings enable row level security;

drop policy if exists "ai_ops_digest_settings_select_member" on public.ai_ops_digest_settings;
create policy "ai_ops_digest_settings_select_member"
on public.ai_ops_digest_settings
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "ai_ops_digest_settings_write_owner_admin_manager"
  on public.ai_ops_digest_settings;
create policy "ai_ops_digest_settings_write_owner_admin_manager"
on public.ai_ops_digest_settings
for all
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = ai_ops_digest_settings.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = ai_ops_digest_settings.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'manager')
  )
);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_ai_ops_digest_settings_set_updated_at on public.ai_ops_digest_settings;
    create trigger trg_ai_ops_digest_settings_set_updated_at
      before update on public.ai_ops_digest_settings
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- ai_ops_digest_runs
-- -----------------------------------------------------------------------------

create table if not exists public.ai_ops_digest_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  triggered_by uuid references auth.users(id) on delete set null,
  trigger_kind text not null
    check (trigger_kind in ('manual', 'cron', 'preview')),
  status text not null
    check (status in ('queued', 'sent', 'skipped', 'failed', 'no_recipients', 'no_items')),
  recipients jsonb not null default '[]'::jsonb,
  items_count integer not null default 0,
  high_count integer not null default 0,
  medium_count integer not null default 0,
  low_count integer not null default 0,
  /** Brief summary text used by the email + future Slack/Teams payload. */
  summary text,
  /** Provider message ID (Resend) when delivery succeeded — never the secret. */
  provider_message_id text,
  error_code text,
  error_message text,
  /** Subset of categories included in this run. Useful when the
      user filters categories in the digest settings. */
  categories jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_ai_ops_digest_runs_org_created
  on public.ai_ops_digest_runs (organization_id, created_at desc);

create index if not exists idx_ai_ops_digest_runs_org_trigger
  on public.ai_ops_digest_runs (organization_id, trigger_kind, created_at desc);

comment on table public.ai_ops_digest_runs is
  'AI Ops Phase 3 — append-only digest delivery history. Used by the digest history UI and future Slack/Teams cool-down logic.';

revoke all on table public.ai_ops_digest_runs from public, anon;
grant select on table public.ai_ops_digest_runs to authenticated;

alter table public.ai_ops_digest_runs enable row level security;

drop policy if exists "ai_ops_digest_runs_select_member" on public.ai_ops_digest_runs;
create policy "ai_ops_digest_runs_select_member"
on public.ai_ops_digest_runs
for select
to authenticated
using (public.is_org_member(organization_id));

-- Inserts/updates happen via service-role (cron) or the API route
-- (server with elevated session) — never directly by an
-- end-user client.
