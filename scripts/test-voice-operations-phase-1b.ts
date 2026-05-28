/**
 * Voice Operations Layer — Phase 1B regression checks.
 * Run: pnpm test:voice-operations-phase-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateVoiceBusinessHours,
  voiceBusinessHoursStatusLabel,
} from "../lib/voice/business-hours/business-hours-evaluator"
import { resolveConversationPhoneForCall } from "../lib/voice/conversations/conversation-engine"
import { resolveVoiceCallOwner } from "../lib/voice/calls/ownership"
import { resolveInboundVoiceRoute } from "../lib/voice/routing/routing-resolver"
import {
  VOICE_FOUNDATION_QA_MARKER,
  VOICE_OPERATIONS_QA_MARKER,
  VOICE_PROVIDER_ABSTRACTION_QA_MARKER,
  VOICE_WEBHOOK_INGESTION_QA_MARKER,
} from "../lib/voice/types"

assert.equal(VOICE_OPERATIONS_QA_MARKER, "voice-operations-v1")
assert.equal(VOICE_FOUNDATION_QA_MARKER, "voice-foundation-v1")
assert.equal(VOICE_PROVIDER_ABSTRACTION_QA_MARKER, "voice-provider-abstraction-v1")
assert.equal(VOICE_WEBHOOK_INGESTION_QA_MARKER, "voice-webhook-ingestion-v1")

const mondayOpen = evaluateVoiceBusinessHours(
  {
    timezone: "America/New_York",
    weeklyScheduleJson: {
      monday: { open: "09:00", close: "17:00" },
    },
    holidayRulesJson: [],
  },
  new Date("2026-05-18T15:00:00.000Z"),
)
assert.equal(["open", "closed", "unknown"].includes(mondayOpen), true)

const holiday = evaluateVoiceBusinessHours(
  {
    timezone: "UTC",
    weeklyScheduleJson: { monday: { open: "09:00", close: "17:00" } },
    holidayRulesJson: [{ date: "2026-05-18", closed: true }],
  },
  new Date("2026-05-18T12:00:00.000Z"),
)
assert.equal(holiday, "holiday")
assert.equal(voiceBusinessHoursStatusLabel("holiday"), "Holiday")

const route = resolveInboundVoiceRoute({
  organizationId: "11111111-1111-4111-8111-111111111111",
  number: {
    id: "n1",
    phoneNumber: "+14155550100",
    status: "active",
    voiceEnabled: true,
    assignedUserId: "22222222-2222-4222-8222-222222222222",
    routingMode: "assigned_user",
    defaultForwardingTarget: "",
    routingProfileId: null,
  },
  fromNumber: "+14155550199",
  businessHoursStatus: "open",
})
assert.equal(route.routeStatus, "resolved")
assert.equal(route.destinationUserIds.length, 1)

const blockedFuture = resolveInboundVoiceRoute({
  organizationId: "11111111-1111-4111-8111-111111111111",
  number: {
    id: "n1",
    phoneNumber: "+14155550100",
    status: "active",
    voiceEnabled: true,
    assignedUserId: null,
    routingMode: "ai_receptionist_future",
    defaultForwardingTarget: "",
    routingProfileId: null,
  },
  fromNumber: "+14155550199",
})
assert.equal(blockedFuture.routeStatus, "blocked")

assert.equal(
  resolveConversationPhoneForCall({
    direction: "inbound",
    fromNumber: "+14155550199",
    toNumber: "+14155550100",
  }),
  "+14155550199",
)

assert.equal(resolveVoiceCallOwner({ assignedUserId: "user-1" }), "user-1")
assert.equal(resolveVoiceCallOwner({ assignedUserId: null }), null)

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270527150000_voice_operations_phase_1b.sql"),
  "utf8",
)
for (const table of [
  "voice_conversations",
  "voice_routing_profiles",
  "voice_routing_profile_members",
  "voice_business_hours",
  "voice_voicemail_boxes",
]) {
  assert.match(migration, new RegExp(table))
}
assert.match(migration, /voice_conversation_id/)
assert.match(migration, /routing_profile_id/)
assert.match(migration, /has_org_role/)

const numbersRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/numbers/route.ts"),
  "utf8",
)
assert.match(numbersRoute, /fetchVoiceNumbersList/)
assert.match(numbersRoute, /VOICE_OPERATIONS_QA_MARKER/)

const ingestion = fs.readFileSync(path.join(process.cwd(), "lib/voice/webhooks/ingestion.ts"), "utf8")
assert.match(ingestion, /resolveOrCreateVoiceConversation/)
assert.match(ingestion, /attachCallToConversation/)

const settingsPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-voice-infrastructure-settings-panel.tsx"),
  "utf8",
)
assert.match(settingsPanel, /VOICE_OPERATIONS_QA_MARKER/)
assert.match(settingsPanel, /Routing profiles/)
assert.match(settingsPanel, /Voicemail boxes/)
assert.match(settingsPanel, /Compliance readiness/)

const operationsRepo = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/repository/voice-operations-repository.ts"),
  "utf8",
)
assert.match(operationsRepo, /DNC enforcement is pending/)

console.log("voice-operations-phase-1b checks passed")
