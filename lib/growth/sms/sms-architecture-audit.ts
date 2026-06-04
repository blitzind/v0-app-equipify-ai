/** Growth Engine Phase 5.1A — SMS architecture audit (client-safe). */

export const GROWTH_SMS_INFRASTRUCTURE_QA_MARKER = "growth-sms-infrastructure-foundation-v1" as const

export const GROWTH_SMS_ARCHITECTURE_REUSABLE_EMAIL = [
  "lib/growth/providers/adapters/provider-adapter-types.ts — adapter contract (send, health, validate)",
  "lib/growth/providers/transport/transport-repository.ts — delivery attempt lifecycle pattern",
  "lib/growth/webhooks/webhook-router.ts — signature verify → dedupe → normalize → route",
  "lib/growth/replies/reply-ingestion-pipeline.ts — dedupe keys, timeline, outbound_replies",
  "lib/growth/inbox/thread-repository.ts — thread CRUD, classification, message append",
  "lib/growth/inbox-sync/inbox-provider-message_map — provider message idempotency",
] as const

export const GROWTH_SMS_ARCHITECTURE_REUSABLE_INBOX = [
  "growth.inbox_threads / growth.inbox_messages — email thread model",
  "lib/growth/inbox/inbox-types.ts — thread + message shapes",
  "lib/growth/inbox-sync/thread-matcher.ts — lead/thread continuity",
  "components/growth/inbox/growth-inbox-workspace-v2-panel.tsx — 3-column workspace shell",
] as const

export const GROWTH_SMS_ARCHITECTURE_REUSABLE_REPLY = [
  "lib/growth/replies/reply-ingestion-pipeline.ts — ingestGrowthReply() canonical path",
  "lib/growth/reply-intelligence/reply-intent-types.ts — source taxonomy",
  "growth.reply_ingestion_events — dedupe + audit",
  "lib/growth/lead-memory/* — memory rebuild on reply (future SMS hook)",
] as const

export const GROWTH_SMS_ARCHITECTURE_REUSABLE_WORKSPACE = [
  "lib/sms/sms-provider-types.server.ts — SmsOutboundProvider interface",
  "lib/sms/queue-transactional-sms-notification.server.ts — compliance gate ordering",
  "public.organization_sms_* — org transactional SMS (separate from Growth outreach)",
  "lib/voice/providers/twilio-provider.ts — Twilio signature validation",
] as const

export const GROWTH_SMS_ARCHITECTURE_LIMITATIONS = [
  "Growth transport channel is email-only today — SMS uses dedicated growth.sms_* tables.",
  "Unified inbox threads are email-centric — SMS uses sms_conversations with inbox bridge (Phase 5.1G).",
  "Reply intelligence pipeline not wired for SMS in 5.1 — threading + storage only.",
  "Sequence execution and sms_future channel placeholder unchanged — no autonomous SMS sends.",
  "Workspace organization_sms_* is transactional-only — Growth SMS is lead-scoped outreach foundation.",
] as const

export type GrowthSmsArchitectureAudit = {
  qa_marker: typeof GROWTH_SMS_INFRASTRUCTURE_QA_MARKER
  reusableEmailInfrastructure: readonly string[]
  reusableInboxInfrastructure: readonly string[]
  reusableReplyIntelligenceInfrastructure: readonly string[]
  reusableWorkspaceSmsInfrastructure: readonly string[]
  limitations: readonly string[]
  architectureMap: {
    outbound: string
    inbound: string
    threading: string
    inbox: string
    futureReplyIntelligence: string
    futureMemory: string
    futureSequences: string
  }
}

export function buildGrowthSmsArchitectureAudit(): GrowthSmsArchitectureAudit {
  return {
    qa_marker: GROWTH_SMS_INFRASTRUCTURE_QA_MARKER,
    reusableEmailInfrastructure: GROWTH_SMS_ARCHITECTURE_REUSABLE_EMAIL,
    reusableInboxInfrastructure: GROWTH_SMS_ARCHITECTURE_REUSABLE_INBOX,
    reusableReplyIntelligenceInfrastructure: GROWTH_SMS_ARCHITECTURE_REUSABLE_REPLY,
    reusableWorkspaceSmsInfrastructure: GROWTH_SMS_ARCHITECTURE_REUSABLE_WORKSPACE,
    limitations: GROWTH_SMS_ARCHITECTURE_LIMITATIONS,
    architectureMap: {
      outbound: "sendSms() → GrowthSmsProviderAdapter → sms_delivery_attempts → Twilio Messages API",
      inbound: "Twilio inbound webhook → sms_provider_events → sms_messages → sms_conversations",
      threading: "normalizeE164 + lead lookup → findOrCreateSmsConversation()",
      inbox: "sms-inbox-bridge maps sms_conversation → GrowthInboxChannelThread (channel=sms)",
      futureReplyIntelligence: "ingestGrowthReply(source=sms_provider_webhook) — Phase 5.2",
      futureMemory: "lead memory rebuild on SMS reply — Phase 5.2+",
      futureSequences: "multichannel sequence_channel_tasks channel=sms — Phase 5.3+",
    },
  }
}
