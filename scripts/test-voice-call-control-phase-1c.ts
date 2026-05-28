/**
 * Voice Call Control Foundation — Phase 1C regression checks.
 * Run: pnpm test:voice-call-control-phase-1c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  mapInboundRouteToCallControlDecision,
  resolveDialNumbersFromRoute,
} from "../lib/voice/call-control/inbound-call-control"
import {
  resolveEffectiveRecordingPolicy,
  shouldRecordCall,
} from "../lib/voice/call-control/recording-policy"
import {
  forwardCallTwiml,
  generateInboundCallResponseTwiml,
  sendToVoicemailTwiml,
} from "../lib/voice/call-control/twilio-twiml"
import { VOICE_CALL_CONTROL_QA_MARKER } from "../lib/voice/call-control/types"
import { buildVoiceInboundTwilioUrl, buildVoiceRecordingCallbackUrl } from "../lib/voice/call-control/urls"
import {
  forwardCall,
  rejectCall,
  sendToVoicemail,
  createTwilioCallControlProvider,
} from "../lib/voice/providers/call-control/twilio-call-control"
import { resolveInboundVoiceRoute } from "../lib/voice/routing/routing-resolver"

assert.equal(VOICE_CALL_CONTROL_QA_MARKER, "voice-call-control-v1")

const provider = createTwilioCallControlProvider()
const forward = forwardCall(provider, { toNumber: "+14155550100", callerId: "+14155550999" })
assert.match(forward.body, /<Dial/)
assert.match(forward.body, /\+14155550100/)

const voicemail = sendToVoicemail(provider, { greetingText: "Leave a message." })
assert.match(voicemail.body, /<Record/)
assert.match(voicemail.body, /Leave a message/)

const reject = rejectCall(provider)
assert.match(reject.body, /<Reject/)

const afterHoursRoute = resolveInboundVoiceRoute({
  organizationId: "11111111-1111-4111-8111-111111111111",
  number: {
    id: "n1",
    phoneNumber: "+14155550100",
    status: "active",
    voiceEnabled: true,
    assignedUserId: null,
    routingMode: "assigned_user",
    defaultForwardingTarget: "",
    routingProfileId: "p1",
  },
  fromNumber: "+14155550199",
  businessHoursStatus: "closed",
  routingProfile: {
    id: "p1",
    organizationId: "11111111-1111-4111-8111-111111111111",
    name: "Main",
    description: "",
    routingMode: "assigned_user",
    fallbackMode: "voicemail_only",
    fallbackPhoneNumber: "",
    voicemailBoxId: "vb1",
    businessHoursId: null,
    metadataJson: {},
    createdAt: "",
    updatedAt: "",
  },
})

assert.equal(afterHoursRoute.routingMode, "voicemail_only")

const voicemailOnly = resolveInboundVoiceRoute({
  organizationId: "11111111-1111-4111-8111-111111111111",
  number: {
    id: "n1",
    phoneNumber: "+14155550100",
    status: "active",
    voiceEnabled: true,
    assignedUserId: null,
    routingMode: "voicemail_only",
    defaultForwardingTarget: "",
    routingProfileId: null,
  },
  fromNumber: "+14155550199",
})

const vmDecision = mapInboundRouteToCallControlDecision({
  route: voicemailOnly,
  dialNumbers: [],
  recordingEnabled: true,
  recordingDisclosureText: null,
})
assert.equal(vmDecision.action, "voicemail")
const vmTwiml = generateInboundCallResponseTwiml({ decision: vmDecision, recordingCallbackUrl: "https://example.com/rec" })
assert.match(vmTwiml, /<Record/)

const forwardRoute = resolveInboundVoiceRoute({
  organizationId: "11111111-1111-4111-8111-111111111111",
  number: {
    id: "n1",
    phoneNumber: "+14155550100",
    status: "active",
    voiceEnabled: true,
    assignedUserId: null,
    routingMode: "forward_to_number",
    defaultForwardingTarget: "+14155550188",
    routingProfileId: null,
  },
  fromNumber: "+14155550199",
  businessHoursStatus: "open",
})

const dialNumbers = resolveDialNumbersFromRoute({
  route: forwardRoute,
  numberDefaultForward: "+14155550188",
  memberForwardNumbers: [],
  roundRobinNumber: null,
})

const forwardDecision = mapInboundRouteToCallControlDecision({
  route: forwardRoute,
  dialNumbers,
  recordingEnabled: shouldRecordCall({
    policy: resolveEffectiveRecordingPolicy({ direction: "inbound", orgDefault: "inbound_only" }),
    direction: "inbound",
  }),
  recordingDisclosureText: "This call may be recorded.",
})

assert.equal(forwardDecision.action, "forward")
assert.match(forwardCallTwiml({ toNumber: "+14155550188", record: true }), /record=/)

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270527160000_voice_call_control_phase_1c.sql"),
  "utf8",
)
assert.match(migration, /voice_call_control_settings/)
assert.match(migration, /voice_recording_policy_kind/)

const inboundRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/voice/inbound/twilio/route.ts"),
  "utf8",
)
assert.match(inboundRoute, /handleTwilioInboundCall/)
assert.match(inboundRoute, /application\/xml/)

const recordingRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/voice/webhooks/twilio/recording/route.ts"),
  "utf8",
)
assert.match(recordingRoute, /ingestVoicemailRecordingCallback/)

assert.match(buildVoiceInboundTwilioUrl("https://app.equipify.ai"), /\/api\/voice\/inbound\/twilio/)
assert.match(buildVoiceRecordingCallbackUrl("https://app.equipify.ai"), /\/recording/)

console.log("voice-call-control-phase-1c checks passed")
