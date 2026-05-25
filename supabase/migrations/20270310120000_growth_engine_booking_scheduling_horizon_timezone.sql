-- Growth Engine — booking page scheduling horizon + timezone mode (slice 6.27D)

alter table growth.booking_pages
  add column if not exists scheduling_horizon_days integer not null default 90,
  add column if not exists minimum_notice_hours integer not null default 0,
  add column if not exists buffer_before_minutes integer not null default 0,
  add column if not exists buffer_after_minutes integer not null default 0,
  add column if not exists max_meetings_per_day integer,
  add column if not exists timezone_mode text not null default 'visitor_local';

update growth.booking_pages
set buffer_after_minutes = buffer_minutes
where buffer_after_minutes = 0
  and buffer_minutes > 0;

alter table growth.booking_pages
  drop constraint if exists booking_pages_scheduling_horizon_days_check;

alter table growth.booking_pages
  add constraint booking_pages_scheduling_horizon_days_check
  check (scheduling_horizon_days >= 1 and scheduling_horizon_days <= 730);

alter table growth.booking_pages
  drop constraint if exists booking_pages_minimum_notice_hours_check;

alter table growth.booking_pages
  add constraint booking_pages_minimum_notice_hours_check
  check (minimum_notice_hours >= 0 and minimum_notice_hours <= 168);

alter table growth.booking_pages
  drop constraint if exists booking_pages_buffer_before_minutes_check;

alter table growth.booking_pages
  add constraint booking_pages_buffer_before_minutes_check
  check (buffer_before_minutes >= 0 and buffer_before_minutes <= 240);

alter table growth.booking_pages
  drop constraint if exists booking_pages_buffer_after_minutes_check;

alter table growth.booking_pages
  add constraint booking_pages_buffer_after_minutes_check
  check (buffer_after_minutes >= 0 and buffer_after_minutes <= 240);

alter table growth.booking_pages
  drop constraint if exists booking_pages_max_meetings_per_day_check;

alter table growth.booking_pages
  add constraint booking_pages_max_meetings_per_day_check
  check (max_meetings_per_day is null or (max_meetings_per_day >= 1 and max_meetings_per_day <= 50));

alter table growth.booking_pages
  drop constraint if exists booking_pages_timezone_mode_check;

alter table growth.booking_pages
  add constraint booking_pages_timezone_mode_check
  check (timezone_mode in ('fixed_host', 'visitor_local', 'visitor_override'));
