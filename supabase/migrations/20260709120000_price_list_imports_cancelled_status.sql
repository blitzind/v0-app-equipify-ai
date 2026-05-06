-- Allow explicit cancelled state for price list imports (user-initiated stop).

alter table public.price_list_imports drop constraint if exists price_list_imports_status_check;

alter table public.price_list_imports add constraint price_list_imports_status_check
  check (
    status in (
      'uploaded',
      'processing',
      'needs_review',
      'approved',
      'failed',
      'cancelled'
    )
  );

comment on column public.price_list_imports.status is
  'Lifecycle: uploaded → processing → needs_review | approved | failed | cancelled.';
