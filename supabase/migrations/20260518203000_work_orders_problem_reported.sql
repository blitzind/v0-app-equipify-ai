-- Customer-reported problem as a first-class column (kept in sync with repair_log.problemReported in app).

alter table public.work_orders
  add column if not exists problem_reported text;

comment on column public.work_orders.problem_reported is
  'What the customer reported; mirrors repair_log.problemReported for queries and forms.';

-- Backfill from existing JSON where present
update public.work_orders w
set problem_reported = nullif(trim(w.repair_log->>'problemReported'), '')
where w.problem_reported is null
  and w.repair_log ? 'problemReported'
  and nullif(trim(w.repair_log->>'problemReported'), '') is not null;
