-- Per-request AI usage for observability, cost attribution, and future billing caps.

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task text not null,
  provider text not null,
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  estimated_cost numeric(14, 6) not null default 0,
  duration_ms integer not null default 0,
  success boolean not null default true,
  created_at timestamptz not null default now(),
  constraint ai_usage_logs_prompt_tokens_nonneg check (prompt_tokens >= 0),
  constraint ai_usage_logs_completion_tokens_nonneg check (completion_tokens >= 0),
  constraint ai_usage_logs_duration_ms_nonneg check (duration_ms >= 0)
);

comment on table public.ai_usage_logs is
  'AI router usage rows; inserted server-side (service role). Members may read own org.';

create index if not exists idx_ai_usage_logs_org_created
  on public.ai_usage_logs (organization_id, created_at desc);

create index if not exists idx_ai_usage_logs_task
  on public.ai_usage_logs (task);

alter table public.ai_usage_logs enable row level security;
alter table public.ai_usage_logs force row level security;

revoke all on public.ai_usage_logs from public, anon;
grant select on public.ai_usage_logs to authenticated;

drop policy if exists "ai_usage_logs_select_member" on public.ai_usage_logs;
create policy "ai_usage_logs_select_member"
on public.ai_usage_logs
for select
to authenticated
using (public.is_org_member (organization_id));

-- Inserts: service role (bypasses RLS). No authenticated insert/update/delete.
