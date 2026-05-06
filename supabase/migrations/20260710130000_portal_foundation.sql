-- Customer portal foundation: portal identities, magic-link tokens, audit trail.
-- Access is intended only via Next.js API routes using the service role (RLS enabled, no broad grants).

create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- portal_users: one login identity per (organization, email), scoped to a customer.
-- -----------------------------------------------------------------------------

create table if not exists public.portal_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null,
  email citext not null check (char_length(trim(email::text)) > 0),
  display_name text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'revoked')),
  invited_at timestamptz,
  activated_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_users_customer_fkey
    foreign key (organization_id, customer_id)
    references public.customers (organization_id, id)
    on delete cascade,
  constraint portal_users_org_email_unique unique (organization_id, email)
);

create index if not exists idx_portal_users_org_customer
  on public.portal_users (organization_id, customer_id);

create index if not exists idx_portal_users_org_status
  on public.portal_users (organization_id, status);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists trg_portal_users_set_updated_at on public.portal_users;
    create trigger trg_portal_users_set_updated_at
    before update on public.portal_users
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

comment on table public.portal_users is
  'Customer portal login identities; scoped to organization + customer.';

-- -----------------------------------------------------------------------------
-- portal_access_links: hashed magic-link / invite tokens (single- or multi-use).
-- -----------------------------------------------------------------------------

create table if not exists public.portal_access_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  portal_user_id uuid not null references public.portal_users (id) on delete cascade,
  token_hash text not null check (char_length(trim(token_hash)) > 0),
  kind text not null default 'magic_login'
    check (kind in ('invite', 'magic_login')),
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint portal_access_links_token_hash_unique unique (token_hash)
);

create index if not exists idx_portal_access_links_org_expires
  on public.portal_access_links (organization_id, expires_at desc);

create index if not exists idx_portal_access_links_portal_user
  on public.portal_access_links (portal_user_id, created_at desc);

comment on table public.portal_access_links is
  'Opaque portal tokens; only SHA-256 hashes are stored.';

-- -----------------------------------------------------------------------------
-- portal_activity_logs: audit trail for portal actions (non-PII friendly).
-- -----------------------------------------------------------------------------

create table if not exists public.portal_activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  portal_user_id uuid references public.portal_users (id) on delete set null,
  action text not null check (char_length(trim(action)) > 0),
  path text,
  resource_type text,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip_inet inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_portal_activity_logs_org_created
  on public.portal_activity_logs (organization_id, created_at desc);

create index if not exists idx_portal_activity_logs_portal_user
  on public.portal_activity_logs (portal_user_id, created_at desc);

comment on table public.portal_activity_logs is
  'Audit events for customer portal usage (login, views, quote actions, etc.).';

-- -----------------------------------------------------------------------------
-- RLS: enabled; no policies for anon/authenticated — use service role from APIs.
-- -----------------------------------------------------------------------------

alter table public.portal_users enable row level security;
alter table public.portal_access_links enable row level security;
alter table public.portal_activity_logs enable row level security;

alter table public.portal_users force row level security;
alter table public.portal_access_links force row level security;
alter table public.portal_activity_logs force row level security;

revoke all on table public.portal_users from public, anon;
revoke all on table public.portal_access_links from public, anon;
revoke all on table public.portal_activity_logs from public, anon;
