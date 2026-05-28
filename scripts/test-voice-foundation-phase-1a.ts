/**
 * Voice Infrastructure Foundation — Phase 1A regression checks.
 * Run: pnpm test:voice-foundation-phase-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assertVoiceCallStatusTransition,
  canTransitionVoiceCallStatus,
  mergeVoiceCallStatus,
} from "../lib/voice/calls/lifecycle-engine"
import { mapTwilioCallStatusEvent } from "../lib/voice/calls/status-mapping"
import { parseTwilioCallCost } from "../lib/voice/calls/cost-parsing"
import { normalizePhoneNumber } from "../lib/voice/phone-normalization"
import { createVoiceProviderInstance, listRegisteredVoiceProviders } from "../lib/voice/providers/registry"
import { mapProviderEventToCanonicalType } from "../lib/voice/webhooks/types"
import { normalizeVoiceWebhookEvent, parseTwilioFormBody } from "../lib/voice/webhooks/normalizer"
import {
  VOICE_CALL_DISPOSITIONS,
  VOICE_CALL_STATUSES,
  VOICE_FOUNDATION_QA_MARKER,
  VOICE_PROVIDER_ABSTRACTION_QA_MARKER,
  VOICE_PROVIDER_IDS,
} from "../lib/voice/types"
import { VOICE_WEBHOOK_INGESTION_QA_MARKER } from "../lib/voice/webhooks/types"

assert.equal(VOICE_FOUNDATION_QA_MARKER, "voice-foundation-v1")
assert.equal(VOICE_PROVIDER_ABSTRACTION_QA_MARKER, "voice-provider-abstraction-v1")
assert.equal(VOICE_WEBHOOK_INGESTION_QA_MARKER, "voice-webhook-ingestion-v1")

assert.deepEqual([...VOICE_PROVIDER_IDS], listRegisteredVoiceProviders().slice(0, VOICE_PROVIDER_IDS.length))
assert.equal(VOICE_CALL_STATUSES.includes("in_progress"), true)
assert.equal(VOICE_CALL_DISPOSITIONS.includes("do_not_call"), true)

assert.equal(normalizePhoneNumber("(415) 555-0100"), "+14155550100")
assert.equal(canTransitionVoiceCallStatus("ringing", "in_progress"), true)
assert.equal(canTransitionVoiceCallStatus("completed", "ringing"), false)
assert.equal(assertVoiceCallStatusTransition("initiated", "ringing").ok, true)
assert.equal(mergeVoiceCallStatus("completed", "ringing").nextStatus, "completed")

assert.equal(mapTwilioCallStatusEvent("in-progress"), "in_progress")
assert.equal(mapTwilioCallStatusEvent("no-answer"), "no_answer")
assert.equal(mapProviderEventToCanonicalType("ringing"), "ringing")
assert.equal(mapProviderEventToCanonicalType("in-progress"), "answered")

const cost = parseTwilioCallCost({ Price: "-0.0120", PriceUnit: "USD" })
assert.equal(cost.costCurrency, "USD")
assert.equal(cost.costAmount, 0.012)

const twilio = createVoiceProviderInstance("twilio")
assert.equal(twilio.providerId, "twilio")
const normalized = twilio.normalizeWebhookEvent({
  CallSid: "CA123",
  CallStatus: "ringing",
  Direction: "outbound-api",
  From: "+14155550100",
  To: "+14155550199",
})
assert.ok(normalized)
const enriched = normalizeVoiceWebhookEvent(normalized!)
assert.equal(enriched.canonicalEventType, "ringing")

const form = parseTwilioFormBody("CallSid=CA123&CallStatus=completed")
assert.equal(form.CallSid, "CA123")

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270527140000_voice_infrastructure_foundation_phase_1a.sql"),
  "utf8",
)
for (const table of [
  "voice_numbers",
  "voice_calls",
  "voice_call_events",
  "voice_recordings",
  "voice_transcripts",
  "voice_opt_outs",
  "voice_provider_configurations",
]) {
  assert.match(migration, new RegExp(table))
}
assert.match(migration, /voice_call_disposition_kind/)
assert.match(migration, /append-only/)
assert.match(migration, /has_org_role/)

const webhookRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/voice/webhooks/twilio/route.ts"),
  "utf8",
)
assert.match(webhookRoute, /ingestVoiceProviderWebhook/)
assert.match(webhookRoute, /VOICE_WEBHOOK_INGESTION_QA_MARKER/)

const settingsPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-voice-infrastructure-settings-panel.tsx"),
  "utf8",
)
assert.match(settingsPanel, /Voice Infrastructure/)
assert.match(settingsPanel, /infrastructure only/)

console.log("voice-foundation-phase-1a checks passed")
