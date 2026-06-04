/**
 * Phase 5.2 — SMS inbox + reply intelligence validation.
 * Run: pnpm test:growth-sms-inbox-reply-intelligence
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { resolveInboxThreadChannel, filterInboxThreadsByChannel } from "../lib/growth/inbox/inbox-channel-types"
import type { GrowthInboxThread } from "../lib/growth/inbox/inbox-types"
import { buildGrowthSmsInboxArchitectureAudit, GROWTH_SMS_INBOX_QA_MARKER } from "../lib/growth/sms/sms-inbox-audit"
import { GROWTH_REPLY_INGESTION_SOURCES } from "../lib/growth/reply-intelligence/reply-intent-types"
import { GROWTH_SMS_REPLY_CONNECTION_ID } from "../lib/growth/sms/schema-health"

console.log("Phase 5.2 — SMS Inbox & Reply Intelligence Validation\n")

const audit = buildGrowthSmsInboxArchitectureAudit()
assert.equal(audit.qa_marker, GROWTH_SMS_INBOX_QA_MARKER)
assert.ok(audit.intelligenceReuse.length >= 3)
assert.ok(audit.memoryReuse.length >= 1)

console.log("=== 5.2A SMS inbox audit ===")
console.log(`Unified model: ${audit.unifiedThreadModel}`)
console.log(`Reply path: ${audit.replyIngestionPath}`)

assert.ok(GROWTH_REPLY_INGESTION_SOURCES.includes("sms_provider_webhook"))
console.log("\n=== Reply ingestion source ===")
console.log("sms_provider_webhook registered")

assert.equal(resolveInboxThreadChannel("twilio_sms"), "sms")
assert.equal(resolveInboxThreadChannel("google"), "email")
console.log("\n=== Channel resolution ===")
console.log("twilio_sms → sms, google → email")

const threads: GrowthInboxThread[] = [
  {
    id: "t-email",
    lead_id: "l1",
    lead_label: "Summit HVAC",
    channel: "email",
    provider_family: "google",
    mailbox_connection_id: null,
    subject: "Re: dispatch workflow",
    thread_status: "open",
    reply_count: 1,
    last_message_at: new Date().toISOString(),
    owner_user_id: null,
    owner_label: null,
    priority_score: 60,
    priority_tier: "normal",
    classification: "positive_interest",
    classification_confidence: 80,
    requires_human_review: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "t-sms",
    lead_id: "l2",
    lead_label: "Alpine Service",
    channel: "sms",
    provider_family: "twilio_sms",
    mailbox_connection_id: null,
    subject: "SMS · +13035550199",
    thread_status: "needs_review",
    reply_count: 1,
    last_message_at: new Date().toISOString(),
    owner_user_id: "u1",
    owner_label: "Operator",
    priority_score: 75,
    priority_tier: "high",
    classification: "positive_interest",
    classification_confidence: 85,
    requires_human_review: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

const smsOnly = filterInboxThreadsByChannel(threads, "sms")
assert.equal(smsOnly.length, 1)
assert.equal(smsOnly[0]?.channel, "sms")
console.log("\n=== Unified queue filter ===")
console.log(`SMS-only filter: ${smsOnly.length} thread(s)`)

const pipelineSource = readFileSync(resolve("lib/growth/replies/reply-ingestion-pipeline.ts"), "utf8")
assert.match(pipelineSource, /ingestGrowthReplyFromSmsWebhook/)
assert.match(pipelineSource, /sms_provider_webhook/)

const smsReplySource = readFileSync(resolve("lib/growth/sms/sms-reply-ingestion.ts"), "utf8")
assert.match(smsReplySource, /finalizeIngestedReplyIntelligence/)
assert.match(smsReplySource, /recordSequenceExitCandidate/)
assert.match(smsReplySource, /rebuildLeadMemoryProfile|ingestGrowthReplyFromSmsWebhook/)

const webhookSource = readFileSync(resolve("lib/growth/sms/webhooks/twilio-sms-ingestion.ts"), "utf8")
assert.match(webhookSource, /processSmsInboundReply/)

const queueUi = readFileSync(resolve("components/growth/inbox/growth-inbox-thread-queue-column.tsx"), "utf8")
assert.match(queueUi, /GROWTH_INBOX_CHANNEL_FILTER_OPTIONS/)
assert.match(queueUi, /GROWTH_INBOX_CHANNEL_LABELS/)

console.log("\n=== Wiring checks ===")
console.log(`SMS reply connection ID: ${GROWTH_SMS_REPLY_CONNECTION_ID}`)
console.log("Pipeline, webhook, UI channel filters verified")

console.log("\n=== End-to-end flow (simulated) ===")
console.log("1. Outbound SMS via sendSms()")
console.log("2. Inbound Twilio webhook → processSmsInboundReply")
console.log("3. addInboxMessage → reply_detected / positive_interest_detected")
console.log("4. ingestGrowthReplyFromSmsWebhook → outbound_replies + memory rebuild")
console.log("5. finalizeIngestedReplyIntelligence → processReplyIntelligence")
console.log("6. recordSequenceExitCandidate when active enrollment exists")
console.log("7. Thread visible in Inbox V2 queue with SMS badge + channel filter")

const operatorSendSource = readFileSync(resolve("lib/growth/inbox/inbox-sms-operator-send.ts"), "utf8")
assert.match(operatorSendSource, /resolveInboxSmsRecipientE164/)
assert.match(operatorSendSource, /mapGrowthSmsSendApiError/)

const smsDraftEmbedSource = readFileSync(
  resolve("components/growth/inbox/growth-inbox-action-center-sms-draft-embed.tsx"),
  "utf8",
)
assert.match(smsDraftEmbedSource, /\/api\/platform\/growth\/sms\/send/)
assert.match(smsDraftEmbedSource, /Review before sending/)
assert.match(smsDraftEmbedSource, /Send SMS/)
assert.match(smsDraftEmbedSource, /GROWTH_SMS_OPERATOR_SEND_QA_MARKER/)

console.log("\n=== Phase 5.5 operator send UI ===")
console.log("Inbox SMS draft embed wired to POST /api/platform/growth/sms/send")

console.log("\n✓ Phase 5.2 validation passed — inbox integration, no sequences/AI.")
