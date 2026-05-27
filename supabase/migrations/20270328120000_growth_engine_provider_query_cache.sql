-- Growth Engine — Provider query cache + cost control (Prompt 30).
-- Server-side only: caches public business discovery listing payloads per provider query.

create table if not exists growth.provider_query_cache (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  query_hash text not null,
  normalized_query text not null default '',
  query_input_json jsonb not null default '{}'::jsonb,
  response_summary text,
  candidate_count int not null default 0,
  cached_result_json jsonb not null default '{}'::jsonb,
  provider_latency_ms int,
  provider_cost_estimate numeric,
  cache_hit_count int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  constraint provider_query_cache_provider_hash_unique unique (provider_name, query_hash)
);

create index if not exists provider_query_cache_provider_hash_idx
  on growth.provider_query_cache (provider_name, query_hash);

create index if not exists provider_query_cache_expires_at_idx
  on growth.provider_query_cache (expires_at);

revoke all on table growth.provider_query_cache from public, anon, authenticated;
grant select, insert, update, delete on table growth.provider_query_cache to service_role;
