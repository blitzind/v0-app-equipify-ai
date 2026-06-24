-- GS-SENDR-SIGNATURE-1A — Separate company display name from website URL on sender profiles.

do $$
begin
  if to_regclass('growth.sender_profiles') is null then
    raise exception 'Missing dependency: growth.sender_profiles';
  end if;
end;
$$;

alter table growth.sender_profiles
  add column if not exists company_name text;

comment on column growth.sender_profiles.company_name is
  'Display company name in email signatures. website holds the hyperlink target URL.';

comment on column growth.sender_profiles.website is
  'Website URL for signature hyperlinks (e.g. https://equipify.ai). company_name is the visible label.';
