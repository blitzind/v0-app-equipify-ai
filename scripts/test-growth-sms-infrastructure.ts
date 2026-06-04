/**
 * Phase 5.1 — SMS infrastructure foundation validation.
 * Run: pnpm test:growth-sms-infrastructure
 */
import assert from "node:assert/strict"
import { mapSmsConversationToChannelThread } from "../lib/growth/inbox/inbox-channel-types"
import { normalizeToE164, phoneLookupKeys } from "../lib/growth/sms/phone-normalization"
import {
  normalizeTwilioSmsStatus,
  parseTwilioFormBody,
} from "../lib/growth/sms/providers/twilio-sms-payload"
import {
  buildGrowthSmsArchitectureAudit,
  GROWTH_SMS_INFRASTRUCTURE_QA_MARKER,
} from "../lib/growth/sms/sms-architecture-audit"
import type { GrowthSmsConversation, GrowthSmsMessage } from "../lib/growth/sms/sms-types"

console.log("Phase 5.1 — SMS Infrastructure Foundation Validation\n")

const audit = buildGrowthSmsArchitectureAudit()
assert.equal(audit.qa_marker, GROWTH_SMS_INFRASTRUCTURE_QA_MARKER)
assert.ok(audit.reusableEmailInfrastructure.length >= 5)
assert.ok(audit.architectureMap.outbound.includes("sendSms"))

console.log("=== 5.1A Architecture audit ===")
console.log(`QA marker: ${audit.qa_marker}`)
console.log(`Reusable email patterns: ${audit.reusableEmailInfrastructure.length}`)
console.log(`Reusable inbox patterns: ${audit.reusableInboxInfrastructure.length}`)
console.log(`Outbound path: ${audit.architectureMap.outbound}`)

console.log("\n=== Phone normalization ===")
const normalized = normalizeToE164("(303) 555-0199")
assert.equal(normalized, "+13035550199")
assert.deepEqual(phoneLookupKeys("+13035550199"), ["+13035550199", "3035550199", "13035550199"])
console.log(`(303) 555-0199 → ${normalized}`)

console.log("\n=== Twilio payload parsing ===")
const inboundBody = "MessageSid=SM123&From=%2B13035550199&To=%2B18333784743&Body=Yes+interested"
const inboundParams = parseTwilioFormBody(inboundBody)
assert.equal(inboundParams.MessageSid, "SM123")
assert.equal(inboundParams.From, "+13035550199")
assert.equal(inboundParams.Body, "Yes interested")

const statusBody = "MessageSid=SM123&MessageStatus=delivered&To=%2B13035550199"
const statusParams = parseTwilioFormBody(statusBody)
assert.equal(normalizeTwilioSmsStatus(statusParams.MessageStatus), "delivered")
console.log("Inbound + status payloads parsed")

console.log("\n=== Inbox channel bridge (5.1G) ===")
const conversation: GrowthSmsConversation = {
  id: "00000000-0000-4000-8000-00000000c1",
  organizationId: null,
  leadId: "00000000-0000-4000-8000-00000000l1",
  participantE164: "+13035550199",
  fromE164: "+18333784743",
  inboxThreadId: "00000000-0000-4000-8000-00000000t1",
  status: "open",
  messageCount: 2,
  lastMessageAt: new Date().toISOString(),
  lastMessagePreview: "Yes interested",
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const messages: GrowthSmsMessage[] = [
  {
    id: "00000000-0000-4000-8000-00000000m1",
    conversationId: conversation.id,
    direction: "outbound",
    body: "Hi Jordan — quick question about dispatch workflow.",
    fromE164: "+18333784743",
    toE164: "+13035550199",
    provider: "twilio",
    providerMessageId: "SMout1",
    status: "delivered",
    deliveryAttemptId: "00000000-0000-4000-8000-00000000a1",
    messageTimestamp: new Date().toISOString(),
    metadata: {},
    createdAt: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-00000000m2",
    conversationId: conversation.id,
    direction: "inbound",
    body: "Yes interested",
    fromE164: "+13035550199",
    toE164: "+18333784743",
    provider: "twilio",
    providerMessageId: "SM123",
    status: "received",
    deliveryAttemptId: null,
    messageTimestamp: new Date().toISOString(),
    metadata: {},
    createdAt: new Date().toISOString(),
  },
]

const channelThread = mapSmsConversationToChannelThread({
  conversation,
  leadLabel: "Summit HVAC",
  messages,
})
assert.equal(channelThread.channel, "sms")
assert.equal(channelThread.messages.length, 2)
assert.equal(channelThread.messages[1]?.bodyPreview, "Yes interested")
console.log(`Channel thread: ${channelThread.channel} · ${channelThread.label} · ${channelThread.messages.length} messages`)

console.log("\n=== End-to-end flow (simulated) ===")
console.log("1. sendSms() → Twilio Messages API (when GROWTH_SMS_SEND_ENABLED=true)")
console.log("2. sms_delivery_attempts status=sent + sms_messages outbound row")
console.log("3. Twilio status webhook → sms_provider_events → delivery_attempt delivered")
console.log("4. Twilio inbound webhook → sms_messages inbound + conversation update")
console.log("5. sms-inbox-bridge → unified inbox thread message append")

console.log("\n✓ Phase 5.1 validation passed — foundation only, no sequences/AI/automation.")
