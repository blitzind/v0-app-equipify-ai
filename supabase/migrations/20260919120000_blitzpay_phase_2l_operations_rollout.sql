-- BlitzPay Phase 2L — rollout flags, reminder run triggers, receipt dispatch skip reason.

alter table public.blitzpay_org_settings
  add column if not exists blitzpay_reminders_enabled boolean not null default true,
  add column if not exists blitzpay_receipt_emails_enabled boolean not null default true;

comment on column public.blitzpay_org_settings.blitzpay_reminders_enabled is
  'When false, automated reminder dispatch skips this workspace.';
comment on column public.blitzpay_org_settings.blitzpay_receipt_emails_enabled is
  'When false, automatic customer receipt emails after BlitzPay capture are skipped (staff resend unaffected).';

alter table public.blitzpay_reminder_runs
  drop constraint if exists blitzpay_reminder_runs_trigger_check;

alter table public.blitzpay_reminder_runs
  add constraint blitzpay_reminder_runs_trigger_check
  check (trigger in ('cron', 'manual', 'dry_run'));

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
      'skipped_org_disabled',
      'failed'
    )
  );
