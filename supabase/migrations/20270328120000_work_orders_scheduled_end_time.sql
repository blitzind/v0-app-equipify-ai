-- Optional scheduled visit end time (pairs with scheduled_time / scheduled_on).

alter table public.work_orders
  add column if not exists scheduled_end_time time without time zone;

comment on column public.work_orders.scheduled_end_time is
  'End of the scheduled visit window. When set with scheduled_time, end must be after start (enforced in app).';
