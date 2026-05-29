-- Allow browser extension intake as a Growth lead source kind.

alter table growth.leads
  drop constraint if exists leads_source_kind_check;

alter table growth.leads
  add constraint leads_source_kind_check
  check (source_kind in (
    'manual',
    'import',
    'web',
    'referral',
    'partner',
    'other',
    'browser_extension'
  ));

comment on column growth.leads.source_kind is
  'Lead origin: manual, import, web, referral, partner, other, or browser_extension (Chrome extension intake).';
