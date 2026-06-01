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
  dialMultipleTwiml,
  forwardCallTwiml,
  generateInboundCallResponseTwiml,
  injectInboundDialMediaStreamTwiml,
  sendToVoicemailTwiml,
} from "../lib/voice/call-control/twilio-twiml"
import { shouldEnableInboundDialMediaStream } from "../lib/voice/media-streaming/inbound-dial-media-stream-config"
import { VOICE_CALL_CONTROL_QA_MARKER } from "../lib/voice/call-control/types"
import { buildVoiceInboundTwilioUrl, buildVoiceRecordingCallbackUrl } from "../lib/voice/call-control/urls"
import { resolveTwilioWebhookValidationUrl } from "../lib/voice/webhooks/twilio-request-url"
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
assert.match(inboundRoute, /validateTwilioIncomingWebhook/)
assert.match(inboundRoute, /resolveTwilioWebhookValidationUrl/)

const directRequest = new Request("https://app.equipify.ai/api/voice/inbound/twilio", {
  headers: { host: "app.equipify.ai", "x-forwarded-proto": "https" },
})
assert.equal(
  resolveTwilioWebhookValidationUrl(directRequest),
  "https://app.equipify.ai/api/voice/inbound/twilio",
)

const forwardedRequest = new Request("https://equipify-app.internal/api/voice/inbound/twilio", {
  headers: {
    "x-forwarded-proto": "https",
    "x-forwarded-host": "app.equipify.ai",
  },
})
assert.equal(
  resolveTwilioWebhookValidationUrl(forwardedRequest),
  "https://app.equipify.ai/api/voice/inbound/twilio",
)

const prevSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
process.env.NEXT_PUBLIC_SITE_URL = "https://app.equipify.ai"
const vercelRequest = new Request("https://equipify-app-abc.vercel.app/api/voice/inbound/twilio")
assert.equal(
  resolveTwilioWebhookValidationUrl(vercelRequest),
  "https://app.equipify.ai/api/voice/inbound/twilio",
)
process.env.NEXT_PUBLIC_SITE_URL = prevSiteUrl

const recordingRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/voice/webhooks/twilio/recording/route.ts"),
  "utf8",
)
assert.match(recordingRoute, /ingestVoicemailRecordingCallback/)

assert.match(buildVoiceInboundTwilioUrl("https://app.equipify.ai"), /\/api\/voice\/inbound\/twilio/)
assert.match(buildVoiceRecordingCallbackUrl("https://app.equipify.ai"), /\/recording/)

const prevDeepgramKey = process.env.DEEPGRAM_API_KEY
process.env.DEEPGRAM_API_KEY = "test-deepgram-key"
assert.equal(shouldEnableInboundDialMediaStream(), true)

const browserDialDecision = {
  qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
  action: "dial" as const,
  routeStatus: "resolved" as const,
  routingMode: "assigned_user" as const,
  dialNumbers: [] as string[],
  dialClientIdentities: ["user_abc123"],
  voicemailBoxId: null,
  recordingEnabled: false,
  recordingDisclosureText: null,
  fallbackReason: null,
  warnings: [] as string[],
}
const dialTwimlWithStream = generateInboundCallResponseTwiml({
  decision: browserDialDecision,
  mediaStream: {
    wssUrl: "wss://app.equipify.ai/api/voice/media/twilio",
    callSid: "CA123",
  },
})
assert.match(dialTwimlWithStream, /<Start><Stream url="wss:\/\/app\.equipify\.ai\/api\/voice\/media\/twilio" track="both_tracks">/)
assert.match(dialTwimlWithStream, /<Parameter name="callSid" value="CA123"/)
assert.match(dialTwimlWithStream, /<Client>user_abc123<\/Client>/)
assert.doesNotMatch(
  generateInboundCallResponseTwiml({ decision: browserDialDecision }),
  /<Start><Stream/,
)

const dialOnlyTwiml = dialMultipleTwiml({ numbers: [], clientIdentities: ["user_x"] })
assert.match(
  injectInboundDialMediaStreamTwiml(dialOnlyTwiml, {
    wssUrl: "wss://app.equipify.ai/api/voice/media/twilio",
  }),
  /<Response><Start><Stream/,
)

process.env.DEEPGRAM_API_KEY = prevDeepgramKey
delete process.env.DEEPGRAM_API_KEY

const inboundHandler = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/call-control/inbound-handler.ts"),
  "utf8",
)
assert.match(inboundHandler, /shouldEnableInboundDialMediaStream/)
assert.match(inboundHandler, /voice_inbound_dial_media_stream_twiml/)
assert.match(inboundHandler, /mediaStreamEnabled/)

import {
  mintTwilioVoiceBrowserAccessToken,
  normalizeTwilioBrowserAccessTokenInput,
  readTwilioBrowserTokenEnv,
} from "../lib/voice/browser-calling/twilio-browser-access-token"
import {
  buildVoiceBrowserTokenMintDiagnostics,
  fingerprintTrimmedApiKeySecret,
} from "../lib/voice/browser-calling/token-diagnostics"
import { formatBrowserRegistrationError } from "../lib/voice/browser-calling/format-browser-registration-error"

const providerRegistrySource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/browser-calling/provider-registry.ts"),
  "utf8",
)
const tokenMintSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/browser-calling/twilio-browser-access-token.ts"),
  "utf8",
)
assert.match(providerRegistrySource, /readTwilioBrowserTokenEnv\(\)/)
assert.match(providerRegistrySource, /mintTwilioVoiceBrowserAccessToken\(/)
assert.match(tokenMintSource, /normalized\.apiKeySecret/)
assert.doesNotMatch(tokenMintSource, /apiKeySecret \|\| authToken/)
assert.doesNotMatch(providerRegistrySource, /apiKeySecret \|\| authToken/)
assert.doesNotMatch(providerRegistrySource, /apiKeySid \|\| accountSid/)
assert.match(tokenMintSource, /apiKeySecret\.trim\(\)/)

const tokenInput = {
  accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  apiKeySid: "SKbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  apiKeySecret: "browser-api-key-secret-value",
  twimlAppSid: "APcccccccccccccccccccccccccccccccc",
  identity: "org_5876176a_user_f24f76d0-c093-4bb0-a982-292548ee9926",
  ttlSeconds: 3600,
}

async function runBrowserTokenMintChecks() {
  const trimmedSecretJwt = await mintTwilioVoiceBrowserAccessToken(tokenInput)
  const paddedSecretJwt = await mintTwilioVoiceBrowserAccessToken({
    ...tokenInput,
    apiKeySecret: "  browser-api-key-secret-value  ",
  })
  assert.equal(trimmedSecretJwt, paddedSecretJwt)

  const trimmedEnvFields = normalizeTwilioBrowserAccessTokenInput({
    ...tokenInput,
    accountSid: " ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ",
    apiKeySid: " SKbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb ",
    apiKeySecret: " browser-api-key-secret-value ",
    twimlAppSid: " APcccccccccccccccccccccccccccccccc ",
    identity: " org_5876176a_user_f24f76d0-c093-4bb0-a982-292548ee9926 ",
  })
  const trimmedEnvJwt = await mintTwilioVoiceBrowserAccessToken(trimmedEnvFields)
  assert.equal(trimmedEnvJwt, trimmedSecretJwt)

  const diagnostics = buildVoiceBrowserTokenMintDiagnostics({
    accountSid: tokenInput.accountSid,
    apiKeySid: tokenInput.apiKeySid,
    apiKeySecret: "  browser-api-key-secret-value  ",
    twimlAppSid: tokenInput.twimlAppSid,
    identity: tokenInput.identity,
    jwt: trimmedSecretJwt,
  })
  assert.equal(diagnostics.signingCredentialSource, "TWILIO_API_KEY_SECRET")
  assert.equal(diagnostics.tokenIssuerSid, tokenInput.apiKeySid)
  assert.equal(diagnostics.tokenSubjectSid, tokenInput.accountSid)
  assert.equal(diagnostics.voiceGrantOutgoingApplicationSid, tokenInput.twimlAppSid)
  assert.equal(
    diagnostics.apiKeySecretFingerprint,
    fingerprintTrimmedApiKeySecret("browser-api-key-secret-value"),
  )
}

const envSnapshot = readTwilioBrowserTokenEnv()
assert.equal(typeof envSnapshot.accountSid, "string")
assert.equal(typeof envSnapshot.apiKeySecret, "string")

assert.match(
  formatBrowserRegistrationError({ code: 31204, message: "JWT is invalid" }),
  /Twilio error 31204: JWT is invalid/,
)

runBrowserTokenMintChecks()
  .then(() => {
    console.log("voice-call-control-phase-1c checks passed")
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
