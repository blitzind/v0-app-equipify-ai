-- Growth Leads inbox: safe archive fields (no hard delete).

alter table growth.leads
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users (id) on delete set null,
  add column if not exists archive_reason text;

create index if not exists idx_growth_leads_archived_at
  on growth.leads (archived_at)
  where archived_at is not null;

create index if not exists idx_growth_leads_active_inbox
  on growth.leads (created_at desc)
  where archived_at is null;
