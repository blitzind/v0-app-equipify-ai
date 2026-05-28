/**
 * Voice transfer + multi-party call control — Phase 1E regression checks.
 * Run: pnpm test:voice-transfer-control-phase-1e
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assertNoDuplicateActiveTransfer,
  initialTransferStatus,
  isActiveTransferStatus,
  mapCancelActionToTransition,
  transferKindRequiresConsult,
  transitionTransferStatus,
} from "../lib/voice/transfer-control/transfer-state-machine"
import { VOICE_TRANSFER_CONTROL_QA_MARKER } from "../lib/voice/transfer-control/types"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"
import { VOICE_CALL_TIMELINE_EVENT_LABELS } from "../lib/voice/browser-calling/status-mapping"
import {
  createMultiPartyCallControlProvider,
  providerCreateConference,
  providerTransferCall,
} from "../lib/voice/providers/call-control/multi-party-call-control"

assert.equal(VOICE_TRANSFER_CONTROL_QA_MARKER, "voice-transfer-control-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v5")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270527180000_voice_transfer_control_phase_1e")

assert.equal(initialTransferStatus("cold"), "starting")
assert.equal(isActiveTransferStatus("consulting"), true)
assert.equal(isActiveTransferStatus("completed"), false)
assert.equal(transferKindRequiresConsult("warm"), true)
assert.equal(transferKindRequiresConsult("cold"), false)

assert.equal(
  assertNoDuplicateActiveTransfer({ activeTransferStatus: "consulting" }).ok,
  false,
)

assert.equal(
  transitionTransferStatus({
    currentStatus: "starting",
    action: "enter_consult",
    transferKind: "warm",
  }).ok,
  true,
)

assert.equal(
  transitionTransferStatus({
    currentStatus: "starting",
    action: "enter_consult",
    transferKind: "cold",
  }).ok,
  false,
)

assert.equal(mapCancelActionToTransition("return_to_operator"), "return_to_operator")
assert.equal(
  transitionTransferStatus({
    currentStatus: "consulting",
    action: mapCancelActionToTransition("return_to_operator"),
    transferKind: "consult",
  }).ok,
  true,
)

async function runProviderScaffoldChecks() {
  const provider = createMultiPartyCallControlProvider("stub")
  const conference = await providerCreateConference(provider, {
    friendlyName: "test",
    voiceCallId: "11111111-1111-4111-8111-111111111111",
  })
  assert.equal(conference.ok, true)
  assert.match(conference.providerReference, /CF_STUB/)

  const transfer = await providerTransferCall(provider, {
    callReference: "CA123",
    targetPhoneNumber: "+14155550100",
    kind: "cold",
  })
  assert.equal(transfer.ok, true)
}

void runProviderScaffoldChecks().then(() => {
  for (const eventType of [
  "transfer_started",
  "transfer_canceled",
  "transfer_completed",
  "participant_joined",
  "participant_left",
  "participant_held",
  "participant_resumed",
  "participant_muted",
  "participant_unmuted",
  "supervisor_joined",
]) {
  assert.equal(typeof VOICE_CALL_TIMELINE_EVENT_LABELS[eventType], "string")
}

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270527180000_voice_transfer_control_phase_1e.sql"),
  "utf8",
)
for (const object of [
  "voice_call_legs",
  "voice_conferences",
  "voice_conference_participants",
  "voice_call_transfers",
  "voice_call_leg_type",
  "voice_transfer_kind",
]) {
  assert.match(migration, new RegExp(object))
}

const schemaHealth = fs.readFileSync(path.join(process.cwd(), "lib/voice/schema-health.ts"), "utf8")
assert.match(schemaHealth, /voice_call_legs/)
assert.match(schemaHealth, /voice_call_control_settings: "organization_id"/)

const serviceSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/transfer-control/call-control-service.ts"),
  "utf8",
)
assert.match(serviceSource, /startVoiceCallTransfer/)
assert.match(serviceSource, /joinVoiceCallAsSupervisor/)
assert.match(serviceSource, /appendTransferTimelineEvent/)

const authSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/transfer-control/call-control-authorization.ts"),
  "utf8",
)
assert.match(authSource, /authorizeVoiceCallControlAction/)
assert.match(authSource, /hasSupervisorRole/)

const transferStartRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/calls/[callId]/transfer/start/route.ts"),
  "utf8",
)
assert.match(transferStartRoute, /requireVoicePlatformRouteContext/)
assert.match(transferStartRoute, /startVoiceCallTransfer/)

const supervisorRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/calls/[callId]/supervisor/join/route.ts"),
  "utf8",
)
assert.match(supervisorRoute, /joinVoiceCallAsSupervisor/)

const workspace = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(workspace, /VOICE_TRANSFER_CONTROL_QA_MARKER/)
assert.match(workspace, /participants\/mute/)
assert.match(workspace, /transfer\/start/)

const centerPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-center-panel.tsx"),
  "utf8",
)
assert.match(centerPanel, /ActiveParticipantsPanel/)
assert.match(centerPanel, /onToggleMute/)
assert.match(centerPanel, /PhoneForwarded/)

const settingsPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-voice-infrastructure-settings-panel.tsx"),
  "utf8",
)
assert.match(settingsPanel, /Multi-party call control readiness/)
assert.match(settingsPanel, /transferControlReadiness/)

  console.log("voice-transfer-control-phase-1e checks passed")
})
