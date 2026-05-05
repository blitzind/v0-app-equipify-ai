-- Organization-level Stripe subscription and trial state (one row per org).
-- Writes from authenticated clients are disabled; service role / webhooks update rows later.

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  plan_id text not null default 'starter',
  billing_cycle text not null default 'monthly',
  status text not null default 'trialing',
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  payment_failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscriptions_org_unique unique (organization_id),
  constraint organization_subscriptions_billing_cycle_check
    check (billing_cycle in ('monthly', 'annual')),
  constraint organization_subscriptions_status_check
    check (
      status in (
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'incomplete',
        'incomplete_expired',
        'paused'
      )
    )
);

comment on table public.organization_subscriptions is
  'One subscription row per organization; Stripe IDs and billing periods updated via service role / webhooks.';

create unique index if not exists idx_organization_subscriptions_stripe_customer_unique
  on public.organization_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists idx_organization_subscriptions_stripe_subscription_unique
  on public.organization_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists idx_organization_subscriptions_stripe_subscription
  on public.organization_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists idx_organization_subscriptions_status
  on public.organization_subscriptions (status);

create index if not exists idx_organization_subscriptions_trial_ends
  on public.organization_subscriptions (trial_ends_at);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is null then
    create function public.set_updated_at()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    begin
      new.updated_at := now();
      return new;
    end
    $fn$;
    revoke all on function public.set_updated_at() from public, anon, authenticated;
    alter function public.set_updated_at() owner to postgres;
  end if;
end
$$;

drop trigger if exists trg_organization_subscriptions_set_updated_at on public.organization_subscriptions;
create trigger trg_organization_subscriptions_set_updated_at
before update on public.organization_subscriptions
for each row execute function public.set_updated_at();

revoke all on table public.organization_subscriptions from public, anon;
grant select on table public.organization_subscriptions to authenticated;

alter table public.organization_subscriptions enable row level security;
alter table public.organization_subscriptions force row level security;

drop policy if exists "organization_subscriptions_select_active_member" on public.organization_subscriptions;
create policy "organization_subscriptions_select_active_member"
on public.organization_subscriptions
for select
to authenticated
using (public.is_org_member(organization_id));

-- Backfill: trialing starter trial for orgs without a row (idempotent).
insert into public.organization_subscriptions (
  organization_id,
  plan_id,
  billing_cycle,
  status,
  trial_starts_at,
  trial_ends_at
)
select
  o.id,
  'starter',
  'monthly',
  'trialing',
  now(),
  now() + interval '14 days'
from public.organizations o
where not exists (
  select 1
  from public.organization_subscriptions s
  where s.organization_id = o.id
);
