-- Billing plan defaults (solo/core/growth/scale) + monthly API usage rollup.

create table if not exists public.organization_api_usage_monthly (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  month_start date not null,
  api_calls integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_api_usage_monthly_org_month_unique unique (organization_id, month_start),
  constraint organization_api_usage_monthly_api_calls_nonneg check (api_calls >= 0)
);

comment on table public.organization_api_usage_monthly is
  'Monthly API call totals per org; service role / backend only for writes.';

create index if not exists idx_organization_api_usage_monthly_org
  on public.organization_api_usage_monthly (organization_id);

create index if not exists idx_organization_api_usage_monthly_month
  on public.organization_api_usage_monthly (month_start);

drop trigger if exists trg_organization_api_usage_monthly_set_updated_at
  on public.organization_api_usage_monthly;
create trigger trg_organization_api_usage_monthly_set_updated_at
before update on public.organization_api_usage_monthly
for each row execute function public.set_updated_at();

revoke all on public.organization_api_usage_monthly from public, anon;
grant select on public.organization_api_usage_monthly to authenticated;

alter table public.organization_api_usage_monthly enable row level security;
alter table public.organization_api_usage_monthly force row level security;

drop policy if exists "organization_api_usage_monthly_select_active_member"
  on public.organization_api_usage_monthly;
create policy "organization_api_usage_monthly_select_active_member"
on public.organization_api_usage_monthly
for select
to authenticated
using (public.is_org_member (organization_id));

-- Legacy `starter` → public pricing ids; new default for new rows.
alter table public.organization_subscriptions
  alter column plan_id set default 'solo';

update public.organization_subscriptions
set
  plan_id = 'solo',
  updated_at = now()
where
  plan_id = 'starter'
  and stripe_subscription_id is null;

update public.organization_subscriptions
set
  plan_id = 'core',
  updated_at = now()
where
  plan_id = 'starter'
  and stripe_subscription_id is not null;

update public.organization_subscriptions
set
  plan_id = 'solo',
  updated_at = now()
where
  plan_id = 'starter';
