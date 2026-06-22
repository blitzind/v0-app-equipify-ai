-- GS-GROWTH-SIGNATURES-1A — Sender profiles + signature template assignment (additive).

do $$
begin
  if to_regclass('growth.sender_accounts') is null then
    raise exception 'Missing dependency: growth.sender_accounts';
  end if;
  if to_regclass('growth.mailbox_connections') is null then
    raise exception 'Missing dependency: growth.mailbox_connections';
  end if;
end;
$$;

create table if not exists growth.sender_profiles (
  id uuid primary key default gen_random_uuid(),
  sender_account_id uuid not null references growth.sender_accounts (id) on delete cascade,
  mailbox_connection_id uuid references growth.mailbox_connections (id) on delete set null,
  display_name text not null default '',
  title text,
  email text not null default '',
  phone text,
  website text,
  linkedin_url text,
  avatar_url text,
  logo_url text,
  active boolean not null default true,
  signature_template text not null default 'simple'
    check (signature_template in ('simple', 'branded', 'minimal')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists idx_growth_sender_profiles_sender_active
  on growth.sender_profiles (sender_account_id)
  where deleted_at is null;

create unique index if not exists idx_growth_sender_profiles_mailbox_active
  on growth.sender_profiles (mailbox_connection_id)
  where deleted_at is null and mailbox_connection_id is not null;

create index if not exists idx_growth_sender_profiles_active
  on growth.sender_profiles (active)
  where deleted_at is null;

comment on table growth.sender_profiles is
  'Outbound sender persona + signature template assignment per mailbox/sender (GS-GROWTH-SIGNATURES-1A).';

revoke all on table growth.sender_profiles from public, anon, authenticated;
grant select, insert, update, delete on table growth.sender_profiles to service_role;
alter table growth.sender_profiles enable row level security;
alter table growth.sender_profiles force row level security;

drop policy if exists growth_sender_profiles_service_role on growth.sender_profiles;
create policy growth_sender_profiles_service_role
  on growth.sender_profiles for all to service_role using (true) with check (true);
