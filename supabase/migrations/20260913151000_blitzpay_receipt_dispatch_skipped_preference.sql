-- Phase 2F — allow explicit skip when customer invoice delivery preference blocks automatic receipt email.

alter table public.blitzpay_payment_receipt_dispatches
  drop constraint if exists blitzpay_payment_receipt_dispatches_send_status_check;

alter table public.blitzpay_payment_receipt_dispatches
  add constraint blitzpay_payment_receipt_dispatches_send_status_check
  check (
    send_status in (
      'queued',
      'sent',
      'skipped_no_email',
      'skipped_unconfigured',
      'skipped_preference',
      'failed'
    )
  );
