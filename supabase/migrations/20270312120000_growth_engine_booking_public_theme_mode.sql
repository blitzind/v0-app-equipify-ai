-- Growth Engine — public booking page theme mode (per-page light/dark/system).

alter table growth.booking_pages
  add column if not exists public_theme_mode text not null default 'system';

update growth.booking_pages
set public_theme_mode = 'system'
where public_theme_mode is null;

alter table growth.booking_pages
  drop constraint if exists booking_pages_public_theme_mode_check;

alter table growth.booking_pages
  add constraint booking_pages_public_theme_mode_check
  check (public_theme_mode in ('system', 'light', 'dark'));
