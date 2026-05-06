-- Organization-level AI spend caps (soft warning vs hard block via app router).

alter table public.organizations
  add column if not exists ai_monthly_budget_cents integer;

alter table public.organizations
  add column if not exists ai_budget_enforcement_mode text not null default 'warn';

alter table public.organizations
  drop constraint if exists organizations_ai_budget_enforcement_mode_check;

alter table public.organizations
  add constraint organizations_ai_budget_enforcement_mode_check
  check (ai_budget_enforcement_mode in ('warn', 'block'));

comment on column public.organizations.ai_monthly_budget_cents is
  'Nullable monthly AI spend cap in USD cents (estimated from ai_usage_logs). Null = unlimited.';

comment on column public.organizations.ai_budget_enforcement_mode is
  'warn = allow overage but log; block = router rejects new AI calls when MTD estimated cost >= budget.';

alter table public.organizations
  drop constraint if exists organizations_ai_monthly_budget_cents_nonneg;

alter table public.organizations
  add constraint organizations_ai_monthly_budget_cents_nonneg
  check (ai_monthly_budget_cents is null or ai_monthly_budget_cents >= 0);
