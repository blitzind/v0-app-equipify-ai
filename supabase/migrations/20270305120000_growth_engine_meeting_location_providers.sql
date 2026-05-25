-- Growth Engine Slice 6.27C — Meeting location provider settings.

do $$
begin
  if to_regclass('growth.communication_settings') is null then
    raise exception 'Missing dependency: growth.communication_settings';
  end if;
  if to_regclass('growth.booking_pages') is null then
    raise exception 'Missing dependency: growth.booking_pages';
  end if;
  if to_regclass('growth.meetings') is null then
    raise exception 'Missing dependency: growth.meetings';
  end if;
end;
$$;

alter table growth.communication_settings
  add column if not exists default_meeting_provider text not null default 'google_meet',
  add column if not exists auto_create_meeting_link boolean not null default true;

alter table growth.communication_settings
  drop constraint if exists communication_settings_default_meeting_provider_check;

alter table growth.communication_settings
  add constraint communication_settings_default_meeting_provider_check
  check (
    default_meeting_provider in (
      'google_meet',
      'zoom',
      'teams',
      'phone_call',
      'custom_location',
      'no_auto_link'
    )
  );

alter table growth.booking_pages
  add column if not exists meeting_provider_override text not null default 'inherit',
  add column if not exists auto_create_meeting_link_override boolean,
  add column if not exists manual_meeting_url text;

alter table growth.booking_pages
  drop constraint if exists booking_pages_meeting_provider_override_check;

alter table growth.booking_pages
  add constraint booking_pages_meeting_provider_override_check
  check (
    meeting_provider_override in (
      'inherit',
      'google_meet',
      'zoom',
      'teams',
      'phone_call',
      'custom_location',
      'no_auto_link'
    )
  );

alter table growth.booking_pages
  drop constraint if exists booking_pages_location_type_check;

alter table growth.booking_pages
  add constraint booking_pages_location_type_check
  check (
    location_type in (
      'google_meet',
      'zoom',
      'teams',
      'phone_call',
      'custom_location',
      'no_auto_link'
    )
  );

alter table growth.meetings
  add column if not exists meeting_location_type text,
  add column if not exists meeting_location_label text,
  add column if not exists manual_meeting_url text,
  add column if not exists auto_create_meeting_link boolean,
  add column if not exists provider_connection_required boolean not null default false;

alter table growth.meetings
  drop constraint if exists meetings_meeting_location_type_check;

alter table growth.meetings
  add constraint meetings_meeting_location_type_check
  check (
    meeting_location_type is null
    or meeting_location_type in (
      'google_meet',
      'zoom',
      'teams',
      'phone_call',
      'custom_location',
      'no_auto_link'
    )
  );
