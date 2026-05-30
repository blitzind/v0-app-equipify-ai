-- Repair growth.leads.source_kind check constraint for Equipify Sales browser extension
-- and acquisition workflows. Idempotent: safe to re-run if an earlier partial migration
-- already added browser_extension but omitted acquisition.

do $$
declare
  invalid_count integer;
begin
  select count(*) into invalid_count
  from growth.leads
  where source_kind not in (
    'manual',
    'import',
    'web',
    'referral',
    'partner',
    'other',
    'browser_extension',
    'acquisition'
  );

  if invalid_count > 0 then
    raise exception
      'growth.leads has % row(s) with source_kind outside the allowed set. Fix data before applying leads_source_kind_check.',
      invalid_count;
  end if;
end $$;

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
    'browser_extension',
    'acquisition'
  ));

comment on column growth.leads.source_kind is
  'Lead origin: manual, import, web, referral, partner, other, browser_extension (Equipify Sales Chrome extension), or acquisition (Growth acquisition pipeline).';
