-- Live quotes/invoices: payload columns, archive, extended status checks, references.

create unique index if not exists idx_work_orders_org_id_composite
  on public.work_orders (organization_id, id);

-- ─── org_quotes ──────────────────────────────────────────────────────────────

alter table public.org_quotes
  add column if not exists equipment_id uuid references public.equipment (id) on delete set null,
  add column if not exists work_order_id uuid references public.work_orders (id) on delete set null,
  add column if not exists expires_at date,
  add column if not exists line_items jsonb not null default '[]'::jsonb,
  add column if not exists notes text,
  add column if not exists internal_notes text,
  add column if not exists sent_at date,
  add column if not exists archived_at timestamptz;

alter table public.org_quotes drop constraint if exists org_quotes_status_check;
alter table public.org_quotes
  add constraint org_quotes_status_check
  check (
    status in (
      'draft',
      'sent',
      'pending_approval',
      'approved',
      'declined',
      'expired'
    )
  );

comment on column public.org_quotes.archived_at is
  'Soft-archive; hidden from default lists when set.';

-- ─── org_invoices ────────────────────────────────────────────────────────────

alter table public.org_invoices
  add column if not exists work_order_id uuid references public.work_orders (id) on delete set null,
  add column if not exists line_items jsonb not null default '[]'::jsonb,
  add column if not exists notes text,
  add column if not exists internal_notes text,
  add column if not exists due_date date,
  add column if not exists quote_id uuid references public.org_quotes (id) on delete set null,
  add column if not exists archived_at timestamptz;

update public.org_invoices
set due_date = issued_at + interval '30 days'
where due_date is null;

alter table public.org_invoices drop constraint if exists org_invoices_status_check;
alter table public.org_invoices
  add constraint org_invoices_status_check
  check (status in ('draft', 'sent', 'unpaid', 'paid', 'overdue', 'void'));

comment on column public.org_invoices.archived_at is
  'Soft-archive; hidden from default lists when set.';
