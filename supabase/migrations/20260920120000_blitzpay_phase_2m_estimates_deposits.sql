-- BlitzPay Phase 2M — estimate deposits, quote-linked hosted pay, financing-ready hooks.

-- ─── org_quotes: deposit policy + lifecycle + financing flags ───────────────

alter table public.org_quotes
  add column if not exists blitzpay_deposit_mode text not null default 'none'
    check (blitzpay_deposit_mode in ('none', 'acceptance', 'fixed', 'percentage', 'full_prepay'));

alter table public.org_quotes
  add column if not exists blitzpay_deposit_fixed_cents bigint
    check (blitzpay_deposit_fixed_cents is null or blitzpay_deposit_fixed_cents >= 0);

alter table public.org_quotes
  add column if not exists blitzpay_deposit_percentage_bps int
    check (
      blitzpay_deposit_percentage_bps is null
      or (blitzpay_deposit_percentage_bps >= 0 and blitzpay_deposit_percentage_bps <= 10000)
    );

alter table public.org_quotes
  add column if not exists blitzpay_deposit_collected_cents bigint not null default 0
    check (blitzpay_deposit_collected_cents >= 0);

alter table public.org_quotes
  add column if not exists blitzpay_deposit_target_cents bigint
    check (blitzpay_deposit_target_cents is null or blitzpay_deposit_target_cents >= 0);

alter table public.org_quotes
  add column if not exists blitzpay_converted_invoice_id uuid references public.org_invoices (id) on delete set null;

alter table public.org_quotes
  add column if not exists blitzpay_financing_ready boolean not null default false;

alter table public.org_quotes
  add column if not exists blitzpay_financing_metadata jsonb not null default '{}'::jsonb;

comment on column public.org_quotes.blitzpay_deposit_mode is
  'BlitzPay estimate deposit policy: none | acceptance (fixed acceptance fee) | fixed | percentage | full_prepay.';
comment on column public.org_quotes.blitzpay_deposit_collected_cents is
  'Succeeded BlitzPay estimate captures toward this quote (not yet applied as invoice credit).';
comment on column public.org_quotes.blitzpay_financing_metadata is
  'Future financing provider hooks (no lending integrations in Phase 2M).';

-- ─── blitzpay_payment_intents: optional quote anchor ─────────────────────────

alter table public.blitzpay_payment_intents
  add column if not exists org_quote_id uuid references public.org_quotes (id) on delete set null;

create index if not exists idx_blitzpay_payment_intents_org_quote_created
  on public.blitzpay_payment_intents (organization_id, org_quote_id, created_at desc)
  where org_quote_id is not null;

-- ─── blitzpay_payment_links: invoice OR quote (exactly one) ───────────────────

alter table public.blitzpay_payment_links alter column org_invoice_id drop not null;

alter table public.blitzpay_payment_links
  add column if not exists org_quote_id uuid references public.org_quotes (id) on delete cascade;

alter table public.blitzpay_payment_links drop constraint if exists blitzpay_payment_links_target_chk;

alter table public.blitzpay_payment_links
  add constraint blitzpay_payment_links_target_chk
  check (
    (org_invoice_id is not null and org_quote_id is null)
    or (org_invoice_id is null and org_quote_id is not null)
  );

create index if not exists idx_blitzpay_payment_links_org_quote_created
  on public.blitzpay_payment_links (organization_id, org_quote_id, created_at desc)
  where org_quote_id is not null;

-- ─── blitzpay_invoice_payment_attempts: invoice OR quote ─────────────────────

alter table public.blitzpay_invoice_payment_attempts alter column org_invoice_id drop not null;

alter table public.blitzpay_invoice_payment_attempts
  add column if not exists org_quote_id uuid references public.org_quotes (id) on delete cascade;

alter table public.blitzpay_invoice_payment_attempts drop constraint if exists blitzpay_invoice_attempts_target_chk;

alter table public.blitzpay_invoice_payment_attempts
  add constraint blitzpay_invoice_attempts_target_chk
  check (
    (org_invoice_id is not null and org_quote_id is null)
    or (org_invoice_id is null and org_quote_id is not null)
  );

drop index if exists public.idx_blitzpay_invoice_attempts_org_invoice_attempt_no;

create unique index if not exists idx_blitzpay_invoice_attempts_org_invoice_attempt_no
  on public.blitzpay_invoice_payment_attempts (organization_id, org_invoice_id, attempt_no)
  where org_invoice_id is not null;

create unique index if not exists idx_blitzpay_invoice_attempts_org_quote_attempt_no
  on public.blitzpay_invoice_payment_attempts (organization_id, org_quote_id, attempt_no)
  where org_quote_id is not null;

create index if not exists idx_blitzpay_invoice_attempts_org_quote_created
  on public.blitzpay_invoice_payment_attempts (organization_id, org_quote_id, created_at desc)
  where org_quote_id is not null;

-- ─── Ledger: optional quote anchor (estimate deposits; reporting filters) ─────

alter table public.blitzpay_ledger_entries
  add column if not exists org_quote_id uuid references public.org_quotes (id) on delete set null;

create index if not exists idx_blitzpay_ledger_org_quote_created
  on public.blitzpay_ledger_entries (organization_id, org_quote_id, created_at desc)
  where org_quote_id is not null;
