-- Growth Engine Phase 5.2 — Allow sms_provider_webhook in reply_ingestion_events.source.
-- Phase 5.2 code ingests SMS replies with source=sms_provider_webhook but the v2 table
-- check constraint only listed email sources, causing post-ingestion pipeline failure.

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
