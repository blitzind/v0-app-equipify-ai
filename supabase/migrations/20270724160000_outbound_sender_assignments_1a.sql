-- AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — Durable outbound sender affinity.

create table if not exists growth.outbound_sender_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  contact_email text not null,
  contact_email_normalized text not null,
  sender_account_id uuid not null references growth.sender_accounts (id),
  mailbox_connection_id uuid references growth.mailbox_connections (id) on delete set null,
  sender_email text not null,
  provider_family text not null,
  assignment_source text not null
    check (assignment_source in (
      'primary_sender',
      'sender_pool',
      'existing_affinity',
      'explicit_migration'
    )),
  assignment_strategy text,
  sender_pool_id uuid references growth.sender_pools (id) on delete set null,
  sender_rotation_decision_id uuid references growth.sender_rotation_decisions (id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'paused_capacity', 'blocked_reconnect', 'migrated')),
  assigned_at timestamptz not null default now(),
  last_used_at timestamptz,
  migration_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_outbound_sender_assignments_active_unique
  on growth.outbound_sender_assignments (organization_id, lead_id, contact_email_normalized)
  where status = 'active';

create index if not exists idx_outbound_sender_assignments_lead
  on growth.outbound_sender_assignments (lead_id, status);

create index if not exists idx_outbound_sender_assignments_sender
  on growth.outbound_sender_assignments (sender_account_id, status);

comment on table growth.outbound_sender_assignments is
  'AVA-MAILBOX-RELIABILITY-AND-AFFINITY-1A — durable lead/contact sender affinity for outbound relationships.';

create or replace function growth.claim_outbound_sender_assignment(
  p_assignment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = growth, public
as $$
declare
  v_existing growth.outbound_sender_assignments%rowtype;
  v_inserted growth.outbound_sender_assignments%rowtype;
begin
  select *
  into v_existing
  from growth.outbound_sender_assignments
  where organization_id = (p_assignment ->> 'organization_id')::uuid
    and lead_id = (p_assignment ->> 'lead_id')::uuid
    and contact_email_normalized = lower(trim(p_assignment ->> 'contact_email'))
    and status = 'active'
  for update;

  if found then
    return jsonb_build_object('ok', true, 'assignment', to_jsonb(v_existing), 'created', false);
  end if;

  insert into growth.outbound_sender_assignments (
    organization_id,
    lead_id,
    contact_email,
    contact_email_normalized,
    sender_account_id,
    mailbox_connection_id,
    sender_email,
    provider_family,
    assignment_source,
    assignment_strategy,
    sender_pool_id,
    sender_rotation_decision_id,
    status,
    assigned_at,
    last_used_at
  )
  values (
    (p_assignment ->> 'organization_id')::uuid,
    (p_assignment ->> 'lead_id')::uuid,
    trim(p_assignment ->> 'contact_email'),
    lower(trim(p_assignment ->> 'contact_email')),
    (p_assignment ->> 'sender_account_id')::uuid,
    nullif(p_assignment ->> 'mailbox_connection_id', '')::uuid,
    trim(p_assignment ->> 'sender_email'),
    trim(p_assignment ->> 'provider_family'),
    trim(p_assignment ->> 'assignment_source'),
    nullif(p_assignment ->> 'assignment_strategy', ''),
    nullif(p_assignment ->> 'sender_pool_id', '')::uuid,
    nullif(p_assignment ->> 'sender_rotation_decision_id', '')::uuid,
    'active',
    coalesce((p_assignment ->> 'assigned_at')::timestamptz, now()),
    coalesce((p_assignment ->> 'last_used_at')::timestamptz, now())
  )
  on conflict do nothing
  returning * into v_inserted;

  if v_inserted.id is not null then
    return jsonb_build_object('ok', true, 'assignment', to_jsonb(v_inserted), 'created', true);
  end if;

  select *
  into v_existing
  from growth.outbound_sender_assignments
  where organization_id = (p_assignment ->> 'organization_id')::uuid
    and lead_id = (p_assignment ->> 'lead_id')::uuid
    and contact_email_normalized = lower(trim(p_assignment ->> 'contact_email'))
    and status = 'active';

  if found then
    return jsonb_build_object('ok', true, 'assignment', to_jsonb(v_existing), 'created', false);
  end if;

  return jsonb_build_object('ok', false, 'code', 'assignment_claim_failed');
end;
$$;

revoke all on function growth.claim_outbound_sender_assignment(jsonb) from public, anon, authenticated;
grant execute on function growth.claim_outbound_sender_assignment(jsonb) to service_role;

grant select, insert, update on table growth.outbound_sender_assignments to service_role;
