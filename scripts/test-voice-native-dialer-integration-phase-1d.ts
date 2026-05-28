/**
 * Voice Native Dialer Infrastructure Integration — Phase 1D regression checks.
 * Run: pnpm test:voice-native-dialer-integration-phase-1d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  mapInboundRouteToCallControlDecision,
  resolveDialNumbersFromRoute,
} from "../lib/voice/call-control/inbound-call-control"
import { dialMultipleTwiml } from "../lib/voice/call-control/twilio-twiml"
import {
  buildVoiceBrowserClientIdentity,
  mapVoiceCallStatusToBrowserCallState,
  mapVoiceCallStatusToNativeSessionStatus,
} from "../lib/voice/browser-calling/status-mapping"
import {
  mergeBrowserAndPstnDialTargets,
  resolveRoundRobinMemberUserId,
} from "../lib/voice/browser-calling/inbound-browser-routing"
import { VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER } from "../lib/voice/browser-calling/types"
import { resolveInboundVoiceRoute } from "../lib/voice/routing/routing-resolver"

assert.equal(VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER, "voice-native-dialer-integration-v1")

const organizationId = "11111111-1111-4111-8111-111111111111"
const userId = "22222222-2222-4222-8222-222222222222"
const clientIdentity = buildVoiceBrowserClientIdentity({ organizationId, userId })
assert.match(clientIdentity, /^org_11111111_user_/)

assert.equal(
  mapVoiceCallStatusToBrowserCallState({ voiceStatus: "in_progress", muted: true }),
  "muted",
)
assert.equal(
  mapVoiceCallStatusToBrowserCallState({ voiceStatus: "in_progress", onHold: true }),
  "held",
)
assert.equal(mapVoiceCallStatusToNativeSessionStatus("in_progress", { onHold: true }), "on_hold")

const simultaneousRoute = resolveInboundVoiceRoute({
  organizationId,
  number: {
    id: "n1",
    phoneNumber: "+14155550100",
    status: "active",
    voiceEnabled: true,
    assignedUserId: null,
    routingMode: "simultaneous_ring",
    defaultForwardingTarget: "",
    routingProfileId: "p1",
  },
  fromNumber: "+14155550199",
  routingProfile: {
    id: "p1",
    organizationId,
    name: "Main",
    description: "",
    routingMode: "simultaneous_ring",
    fallbackMode: "voicemail_only",
    fallbackPhoneNumber: "",
    voicemailBoxId: "vb1",
    businessHoursId: null,
    metadataJson: {},
    createdAt: "",
    updatedAt: "",
  },
  routingMembers: [
    {
      id: "m1",
      organizationId,
      routingProfileId: "p1",
      userId,
      priority: 1,
      isActive: true,
      forwardingPhoneNumber: "+14155550200",
      browserClientIdentity: clientIdentity,
      metadataJson: {},
      createdAt: "",
      updatedAt: "",
    },
  ],
})

const dialNumbers = resolveDialNumbersFromRoute({
  route: simultaneousRoute,
  numberDefaultForward: "",
  memberForwardNumbers: ["+14155550200"],
})

const merged = mergeBrowserAndPstnDialTargets({
  browserClientIdentities: [clientIdentity],
  pstnNumbers: dialNumbers,
  preferBrowser: true,
})
assert.deepEqual(merged.clientIdentities, [clientIdentity])
assert.deepEqual(merged.pstnNumbers, dialNumbers)

const decision = mapInboundRouteToCallControlDecision({
  route: simultaneousRoute,
  dialNumbers: merged.pstnNumbers,
  dialClientIdentities: merged.clientIdentities,
  recordingEnabled: false,
  recordingDisclosureText: null,
})
assert.equal(decision.action, "dial")
assert.deepEqual(decision.dialClientIdentities, [clientIdentity])

const twiml = dialMultipleTwiml({
  numbers: ["+14155550200"],
  clientIdentities: [clientIdentity],
  callerId: "+14155550100",
  simultaneous: true,
})
assert.match(twiml, /<Client>org_11111111_user_/)
assert.match(twiml, /<Number>\+14155550200<\/Number>/)

const roundRobinUserId = resolveRoundRobinMemberUserId({
  members: [
    {
      id: "m1",
      organizationId,
      routingProfileId: "p1",
      userId,
      priority: 1,
      isActive: true,
      forwardingPhoneNumber: "+14155550200",
      browserClientIdentity: null,
      metadataJson: {},
      createdAt: "",
      updatedAt: "",
    },
  ],
  roundRobinNumber: "+14155550200",
})
assert.equal(roundRobinUserId, userId)

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270527170000_voice_browser_calling_phase_1d.sql"),
  "utf8",
)
assert.match(migration, /voice_browser_devices/)
assert.match(migration, /voice_operator_presence/)
assert.match(migration, /voice_call_id/)

const tokenRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/browser/token/route.ts"),
  "utf8",
)
assert.match(tokenRoute, /requireVoicePlatformRouteContext/)
assert.match(tokenRoute, /VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER/)

const syncRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/browser/sync/route.ts"),
  "utf8",
)
assert.match(syncRoute, /buildVoiceBrowserSyncSnapshot/)

const inboundHandler = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/call-control/inbound-handler.ts"),
  "utf8",
)
assert.match(inboundHandler, /resolveInboundDialTargetsWithBrowser/)
assert.match(inboundHandler, /provisionInboundBrowserWorkspaceOffers/)

const workspace = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace.tsx"),
  "utf8",
)
assert.match(workspace, /useVoiceBrowserCalling/)
assert.match(workspace, /VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER/)

const settingsPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-voice-infrastructure-settings-panel.tsx"),
  "utf8",
)
assert.match(settingsPanel, /Browser calling readiness/)
assert.match(settingsPanel, /Operator presence/)
assert.match(settingsPanel, /VOICE_NATIVE_DIALER_INTEGRATION_QA_MARKER/)

const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
  scripts: Record<string, string>
  dependencies: Record<string, string>
}
assert.match(packageJson.scripts["test:voice-native-dialer-integration-phase-1d"], /test-voice-native-dialer-integration-phase-1d/)
assert.ok(packageJson.dependencies.twilio)
assert.ok(packageJson.dependencies["@twilio/voice-sdk"])

console.log("voice-native-dialer-integration-phase-1d checks passed")
