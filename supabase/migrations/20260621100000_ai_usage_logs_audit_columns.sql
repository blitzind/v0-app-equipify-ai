-- Operational audit fields for ai_usage_logs (no prompts or customer message bodies).

alter table public.ai_usage_logs
  add column if not exists failure_reason text,
  add column if not exists cache_hit boolean not null default false,
  add column if not exists budget_blocked boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.ai_usage_logs.failure_reason is
  'Short operational reason for failures (never store raw prompts or PII).';
comment on column public.ai_usage_logs.cache_hit is
  'True when this row represents a cache hit (tokens/cost typically zero).';
comment on column public.ai_usage_logs.budget_blocked is
  'True when the router blocked the call due to organization AI budget.';
comment on column public.ai_usage_logs.metadata is
  'Small JSON bag for ops only (e.g. escalation flags). Do not store prompts or extracted document text.';

create index if not exists idx_ai_usage_logs_month_success
  on public.ai_usage_logs (organization_id, created_at desc, success);

create index if not exists idx_ai_usage_logs_budget_blocked
  on public.ai_usage_logs (budget_blocked, created_at desc)
  where budget_blocked = true;

create index if not exists idx_ai_usage_logs_cache_hit
  on public.ai_usage_logs (cache_hit, created_at desc)
  where cache_hit = true;
