-- Growth Engine SR-2B-4 — Share page booking attribution metadata

alter table growth.booking_page_bookings
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column growth.booking_page_bookings.metadata is
  'First-party booking attribution metadata (share page, campaign, enrollment, etc.).';
