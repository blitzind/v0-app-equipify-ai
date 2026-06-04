/** Growth Engine Phase 5.2A — SMS inbox integration audit (client-safe). */

export const GROWTH_SMS_INBOX_QA_MARKER = "growth-sms-inbox-reply-intelligence-v1" as const

export type GrowthSmsInboxArchitectureAudit = {
  qa_marker: typeof GROWTH_SMS_INBOX_QA_MARKER
  unifiedThreadModel: string
  smsAppearanceInQueue: string
  replyIngestionPath: string
  intelligenceReuse: string[]
  memoryReuse: string[]
  timelineReuse: string[]
  limitations: string[]
}

export function buildGrowthSmsInboxArchitectureAudit(): GrowthSmsInboxArchitectureAudit {
  return {
    qa_marker: GROWTH_SMS_INBOX_QA_MARKER,
    unifiedThreadModel:
      "SMS threads live in growth.inbox_threads (provider_family=twilio_sms) with channel=sms on GrowthInboxThread; messages in inbox_messages via sms-inbox-bridge.",
    smsAppearanceInQueue:
      "SMS threads appear in the same V2 thread queue as email — filtered by channel badge (Email/SMS) without a separate list API.",
    replyIngestionPath:
      "Twilio inbound → sms_messages → appendSmsMessageToInboxBridge → ingestGrowthReplyFromSmsWebhook → finalizeIngestedReplyIntelligence",
    intelligenceReuse: [
      "addInboxMessage → recomputeThreadIntelligence → reply_detected / positive_interest_detected",
      "classifyReplyIntentV2 via ingestGrowthReply → outbound_replies",
      "processReplyIntelligence via finalizeIngestedReplyIntelligence",
      "recordSequenceExitCandidate from inbox-sync-events",
    ],
    memoryReuse: [
      "ingestGrowthReply → rebuildLeadMemoryProfile",
      "lead_memory_events via existing memory pipeline",
    ],
    timelineReuse: [
      "reply_ingested on lead timeline",
      "reply_received fallback when outbound connection path skipped",
      "reply-intelligence-timeline-emitter via processReplyIntelligence",
      "platform reply_intelligence_events via addInboxMessage",
    ],
    limitations: [
      "No separate unread counter — uses requires_human_review + thread_status as attention signal.",
      "SMS sequence enrollment attribution uses active enrollment lookup — not delivery_attempt thread match yet.",
      "No SMS AI generation or sequence send in Phase 5.2.",
    ],
  }
}
