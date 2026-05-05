create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null default 'tech' check (role in ('admin', 'manager', 'tech', 'viewer')),
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_invites_token on public.invites (token);
create index if not exists idx_invites_org_email on public.invites (organization_id, email);
create index if not exists idx_invites_expires_at on public.invites (expires_at);

alter table public.invites enable row level security;
