-- Growth Engine Phase 5.2 — Allow sms_provider_webhook in reply_ingestion_events.source.
-- Renamed from 20270704120000_* to 20270704120001_* so it runs before native warmup (120002).
-- Idempotent: drop/recreate source check only; safe to re-apply.
-- If you already applied this SQL under the old migration name, run after push:
--   supabase migration repair --status applied 20270704120001_growth_sms_reply_ingestion_source

alter table growth.reply_ingestion_events
  drop constraint if exists reply_ingestion_events_source_check;

alter table growth.reply_ingestion_events
  add constraint reply_ingestion_events_source_check
  check (
    source in (
      'provider_webhook',
      'google_mailbox_sync',
      'sms_provider_webhook',
      'tracking_event',
      'manual_import'
    )
  );
