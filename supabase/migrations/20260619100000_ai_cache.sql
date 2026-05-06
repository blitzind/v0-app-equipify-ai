-- Deterministic AI response cache (hash-keyed, tenant-scoped).

create table if not exists public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  /** Deterministic lookup key (sha256 of org + task + input_hash + model_signature). */
  storage_key text not null,
  task text not null,
  input_hash text not null,
  model_signature text not null,
  response_json jsonb,
  response_text text,
  confidence_score numeric,
  expires_at timestamptz,
  hit_count integer not null default 0,
  last_hit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_cache_storage_key_unique unique (storage_key),
  constraint ai_cache_hit_count_nonneg check (hit_count >= 0)
);

comment on table public.ai_cache is
  'Hash-keyed AI outputs for deduplication; populated server-side (service role). Members may read own org.';

create index if not exists idx_ai_cache_org_task on public.ai_cache (organization_id, task);
create index if not exists idx_ai_cache_last_hit on public.ai_cache (organization_id, last_hit_at desc nulls last);

alter table public.ai_cache enable row level security;
alter table public.ai_cache force row level security;

revoke all on public.ai_cache from public, anon;
grant select on public.ai_cache to authenticated;

drop policy if exists "ai_cache_select_member" on public.ai_cache;
create policy "ai_cache_select_member"
on public.ai_cache
for select
to authenticated
using (
  organization_id is not null
  and public.is_org_member (organization_id)
);
