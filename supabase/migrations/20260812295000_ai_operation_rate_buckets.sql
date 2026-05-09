-- Fixed-window per-minute counters for org-scoped AI-adjacent endpoints (soft abuse protection).

create table if not exists public.ai_operation_rate_buckets (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  operation_key text not null,
  minute_bucket bigint not null,
  request_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organization_id, operation_key, minute_bucket)
);

create index if not exists idx_ai_op_rate_org_updated
  on public.ai_operation_rate_buckets (organization_id, updated_at desc);

comment on table public.ai_operation_rate_buckets is
  'Per-org rolling minute buckets for lightweight AI route rate limits (regeneration, evaluation, insight refresh).';

alter table public.ai_operation_rate_buckets enable row level security;
