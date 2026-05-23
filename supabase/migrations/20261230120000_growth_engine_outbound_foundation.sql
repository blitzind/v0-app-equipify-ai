-- Growth Engine slice 5.1A: outbound event foundation (provider-agnostic).

do $$
begin
  if to_regclass('growth.leads') is null then
    raise exception 'Missing dependency: growth.leads';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- growth.leads — contact temperature cache
-- -----------------------------------------------------------------------------

alter table growth.leads
  add column if not exists contact_temperature text
    check (contact_temperature is null or contact_temperature in ('cold', 'warming', 'engaged', 'hot', 'suppressed'));

create index if not exists idx_growth_leads_contact_temperature
  on growth.leads (contact_temperature, updated_at desc);

-- -----------------------------------------------------------------------------
-- growth.lead_timeline_events — outbound FKs + email event types
-- -----------------------------------------------------------------------------

alter table growth.lead_timeline_events
  add column if not exists outbound_message_id uuid,
  add column if not exists message_event_id uuid,
  add column if not exists outbound_reply_id uuid;

alter table growth.lead_timeline_events
  drop constraint if exists lead_timeline_events_event_type_check;

alter table growth.lead_timeline_events
  add constraint lead_timeline_events_event_type_check check (event_type in (
    'lead_created', 'research_started', 'research_completed', 'research_failed',
    'website_fetch_failed', 'website_fetch_fixed',
    'decision_maker_added', 'decision_maker_confirmed', 'decision_maker_rejected',
    'call_attempted', 'voicemail_left', 'interested',
    'follow_up_created', 'follow_up_completed',
    'notes_updated', 'priority_changed', 'override_changed', 'next_best_action_changed',
    'website_changed', 'status_changed', 'import_created', 'import_updated', 'manual_touch',
    'email_sent', 'email_delivered', 'email_opened', 'email_clicked', 'email_replied',
    'email_bounced', 'email_unsubscribed', 'email_failed', 'email_spam_complaint',
    'email_suppressed', 'email_unmatched'
  ));

-- -----------------------------------------------------------------------------
-- growth.email_provider_connections
-- -----------------------------------------------------------------------------

create table if not exists growth.email_provider_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_family text not null check (provider_family in ('emailbison', 'smartlead', 'instantly', 'custom')),
  label text not null,
  status text not null default 'active' check (status in ('active', 'disabled', 'error')),
  api_base_url text,
  credentials_encrypted text,
  webhook_secret text,
  config jsonb not null default '{}'::jsonb,
  last_webhook_at timestamptz,
  last_error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_email_connections_provider
  on growth.email_provider_connections (provider, status);

-- -----------------------------------------------------------------------------
-- growth.outbound_campaigns
-- -----------------------------------------------------------------------------

create table if not exists growth.outbound_campaigns (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references growth.email_provider_connections (id) on delete cascade,
  provider text not null,
  provider_campaign_id text,
  name text not null,
  campaign_type text not null default 'unknown'
    check (campaign_type in ('sequence', 'broadcast', 'unknown')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  source_channel text,
  source_campaign text,
  sent_count int not null default 0 check (sent_count >= 0),
  reply_count int not null default 0 check (reply_count >= 0),
  positive_reply_count int not null default 0 check (positive_reply_count >= 0),
  call_ready_count int not null default 0 check (call_ready_count >= 0),
  unsubscribe_count int not null default 0 check (unsubscribe_count >= 0),
  bounce_count int not null default 0 check (bounce_count >= 0),
  engagement_score numeric(6, 2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_campaign_id)
);

create index if not exists idx_growth_outbound_campaigns_connection
  on growth.outbound_campaigns (connection_id, status);

-- -----------------------------------------------------------------------------
-- growth.outbound_contacts
-- -----------------------------------------------------------------------------

create table if not exists growth.outbound_contacts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references growth.email_provider_connections (id) on delete cascade,
  campaign_id uuid references growth.outbound_campaigns (id) on delete set null,
  lead_id uuid references growth.leads (id) on delete set null,
  decision_maker_id uuid references growth.lead_decision_makers (id) on delete set null,
  email text not null,
  provider_contact_id text,
  enrollment_status text not null default 'pending'
    check (enrollment_status in ('pending', 'active', 'paused', 'completed', 'suppressed')),
  first_contacted_at timestamptz,
  last_event_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_outbound_contacts_lead
  on growth.outbound_contacts (lead_id);

create index if not exists idx_growth_outbound_contacts_email
  on growth.outbound_contacts (lower(email));

create unique index if not exists idx_growth_outbound_contacts_provider
  on growth.outbound_contacts (connection_id, provider_contact_id)
  where provider_contact_id is not null;

-- -----------------------------------------------------------------------------
-- growth.outbound_messages
-- -----------------------------------------------------------------------------

create table if not exists growth.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references growth.email_provider_connections (id) on delete cascade,
  contact_id uuid not null references growth.outbound_contacts (id) on delete cascade,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  campaign_id uuid references growth.outbound_campaigns (id) on delete set null,
  provider_message_id text,
  sequence_step int,
  subject text,
  body_preview text,
  sent_at timestamptz,
  delivered_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_growth_outbound_messages_provider
  on growth.outbound_messages (connection_id, provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_growth_outbound_messages_lead
  on growth.outbound_messages (lead_id, sent_at desc nulls last);

-- -----------------------------------------------------------------------------
-- growth.provider_webhooks
-- -----------------------------------------------------------------------------

create table if not exists growth.provider_webhooks (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references growth.email_provider_connections (id) on delete cascade,
  provider text not null,
  headers jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  signature_valid boolean,
  status text not null default 'received'
    check (status in ('received', 'processed', 'failed', 'ignored')),
  resolution_status text not null default 'resolved'
    check (resolution_status in ('resolved', 'unresolved', 'ignored')),
  resolved_lead_id uuid references growth.leads (id) on delete set null,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_growth_provider_webhooks_unresolved
  on growth.provider_webhooks (resolution_status, created_at desc);

-- -----------------------------------------------------------------------------
-- growth.message_events
-- -----------------------------------------------------------------------------

create table if not exists growth.message_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references growth.email_provider_connections (id) on delete cascade,
  lead_id uuid references growth.leads (id) on delete set null,
  contact_id uuid references growth.outbound_contacts (id) on delete set null,
  message_id uuid references growth.outbound_messages (id) on delete set null,
  webhook_id uuid references growth.provider_webhooks (id) on delete set null,
  event_type text not null check (event_type in (
    'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced',
    'unsubscribed', 'failed', 'spam_complaint'
  )),
  provider text not null,
  provider_event_id text not null,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_growth_message_events_provider
  on growth.message_events (connection_id, provider_event_id);

create index if not exists idx_growth_message_events_lead
  on growth.message_events (lead_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- growth.outbound_replies
-- -----------------------------------------------------------------------------

create table if not exists growth.outbound_replies (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references growth.email_provider_connections (id) on delete cascade,
  message_id uuid references growth.outbound_messages (id) on delete set null,
  contact_id uuid references growth.outbound_contacts (id) on delete set null,
  lead_id uuid not null references growth.leads (id) on delete cascade,
  message_event_id uuid not null references growth.message_events (id) on delete cascade,
  provider_reply_id text,
  received_at timestamptz not null,
  body_preview text,
  classification text not null default 'unclassified'
    check (classification in ('interested', 'not_interested', 'objection', 'out_of_office', 'referral', 'unclassified')),
  sentiment text not null default 'unknown'
    check (sentiment in ('positive', 'neutral', 'negative', 'unknown')),
  confidence numeric(4, 3) not null default 0,
  classification_locked boolean not null default false,
  classification_locked_by uuid references auth.users (id) on delete set null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_growth_outbound_replies_provider
  on growth.outbound_replies (connection_id, provider_reply_id)
  where provider_reply_id is not null;

create index if not exists idx_growth_outbound_replies_lead
  on growth.outbound_replies (lead_id, received_at desc);

-- -----------------------------------------------------------------------------
-- growth.suppression_entries
-- -----------------------------------------------------------------------------

create table if not exists growth.suppression_entries (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text not null check (reason in ('unsubscribe', 'bounce_hard', 'spam_complaint', 'manual', 'legal')),
  source text not null check (source in ('provider_webhook', 'manual', 'fixture')),
  lead_id uuid references growth.leads (id) on delete set null,
  contact_id uuid references growth.outbound_contacts (id) on delete set null,
  message_event_id uuid references growth.message_events (id) on delete set null,
  notes text,
  suppressed_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_growth_suppression_email
  on growth.suppression_entries (lower(email));

-- -----------------------------------------------------------------------------
-- timeline FK constraints (after outbound tables exist)
-- -----------------------------------------------------------------------------

alter table growth.lead_timeline_events
  drop constraint if exists lead_timeline_events_outbound_message_id_fkey,
  drop constraint if exists lead_timeline_events_message_event_id_fkey,
  drop constraint if exists lead_timeline_events_outbound_reply_id_fkey;

alter table growth.lead_timeline_events
  add constraint lead_timeline_events_outbound_message_id_fkey
    foreign key (outbound_message_id) references growth.outbound_messages (id) on delete set null,
  add constraint lead_timeline_events_message_event_id_fkey
    foreign key (message_event_id) references growth.message_events (id) on delete set null,
  add constraint lead_timeline_events_outbound_reply_id_fkey
    foreign key (outbound_reply_id) references growth.outbound_replies (id) on delete set null;

-- -----------------------------------------------------------------------------
-- grants + RLS
-- -----------------------------------------------------------------------------

revoke all on table growth.email_provider_connections from public, anon, authenticated;
revoke all on table growth.outbound_campaigns from public, anon, authenticated;
revoke all on table growth.outbound_contacts from public, anon, authenticated;
revoke all on table growth.outbound_messages from public, anon, authenticated;
revoke all on table growth.message_events from public, anon, authenticated;
revoke all on table growth.outbound_replies from public, anon, authenticated;
revoke all on table growth.provider_webhooks from public, anon, authenticated;
revoke all on table growth.suppression_entries from public, anon, authenticated;

grant select, insert, update, delete on table growth.email_provider_connections to service_role;
grant select, insert, update, delete on table growth.outbound_campaigns to service_role;
grant select, insert, update, delete on table growth.outbound_contacts to service_role;
grant select, insert, update, delete on table growth.outbound_messages to service_role;
grant select, insert, update, delete on table growth.message_events to service_role;
grant select, insert, update, delete on table growth.outbound_replies to service_role;
grant select, insert, update, delete on table growth.provider_webhooks to service_role;
grant select, insert, update, delete on table growth.suppression_entries to service_role;

alter table growth.email_provider_connections enable row level security;
alter table growth.outbound_campaigns enable row level security;
alter table growth.outbound_contacts enable row level security;
alter table growth.outbound_messages enable row level security;
alter table growth.message_events enable row level security;
alter table growth.outbound_replies enable row level security;
alter table growth.provider_webhooks enable row level security;
alter table growth.suppression_entries enable row level security;

alter table growth.email_provider_connections force row level security;
alter table growth.outbound_campaigns force row level security;
alter table growth.outbound_contacts force row level security;
alter table growth.outbound_messages force row level security;
alter table growth.message_events force row level security;
alter table growth.outbound_replies force row level security;
alter table growth.provider_webhooks force row level security;
alter table growth.suppression_entries force row level security;
