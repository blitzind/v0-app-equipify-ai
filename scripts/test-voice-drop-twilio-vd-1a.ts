/**
 * Voice drop Twilio provider — VD-1A regression checks.
 * Run: pnpm test:voice-drop-twilio-vd-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { twilioVoiceDropProvider } from "../lib/voice/voice-drops/twilio-voice-drop-provider"
import {
  buildVoiceDropStatusWebhookUrl,
  buildVoiceDropTwimlWebhookUrl,
  VOICE_DROP_TWILIO_VD_1A_QA_MARKER,
} from "../lib/voice/voice-drops/twilio-voice-drop-config"
import {
  buildVoiceDropOutboundTwiml,
  mapVoiceDropAnsweredByToDeliveryOutcome,
  normalizeVoiceDropAnsweredBy,
  resolveVoiceDropPlayback,
} from "../lib/voice/voice-drops/twilio-voice-drop-twiml"
import { VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED } from "../lib/voice/voice-drops/types"

assert.equal(VOICE_DROP_TWILIO_VD_1A_QA_MARKER, "voice-drop-twilio-vd-1a")
assert.equal(VOICE_DROP_AUTONOMOUS_OUTBOUND_DISABLED, true)

const orgId = "11111111-1111-4111-8111-111111111111"
const recipientId = "22222222-2222-4222-8222-222222222222"

const twimlUrl = buildVoiceDropTwimlWebhookUrl({
  origin: "https://app.example.com",
  organizationId: orgId,
  recipientId,
})
assert.match(twimlUrl, /\/api\/voice\/webhooks\/twilio\/voice-drop\/twiml/)
assert.match(twimlUrl, /organizationId=/)
assert.match(twimlUrl, /recipientId=/)

const statusUrl = buildVoiceDropStatusWebhookUrl({
  origin: "https://app.example.com",
  organizationId: orgId,
  recipientId,
})
assert.match(statusUrl, /\/api\/voice\/webhooks\/twilio\/voice-drop\/status/)

const machineTwiml = buildVoiceDropOutboundTwiml({
  answeredBy: "machine_end_beep",
  message: "Hi Jane, please call us back.",
  voiceId: "Polly.Joanna",
})
assert.match(machineTwiml, /<Say voice="Polly\.Joanna">/)
assert.match(machineTwiml, /Hi Jane/)
assert.match(machineTwiml, /<Hangup\/>/)

const humanTwiml = buildVoiceDropOutboundTwiml({
  answeredBy: "human",
  message: "Should not play",
})
assert.doesNotMatch(humanTwiml, /Should not play/)
assert.match(humanTwiml, /<Hangup\/>/)

const playTwiml = buildVoiceDropOutboundTwiml({
  answeredBy: "machine_end_beep",
  message: "ignored",
  voiceId: "https://cdn.example.com/voicemail.mp3",
})
assert.match(playTwiml, /<Play>https:\/\/cdn\.example\.com\/voicemail\.mp3<\/Play>/)

assert.equal(normalizeVoiceDropAnsweredBy("machine_end_beep"), "machine_end_beep")
assert.equal(normalizeVoiceDropAnsweredBy("MACHINE_START"), "machine_start")

const deliveredOutcome = mapVoiceDropAnsweredByToDeliveryOutcome("machine_end_beep")
assert.equal(deliveredOutcome.delivered, true)
assert.equal(deliveredOutcome.failureReason, null)

const humanOutcome = mapVoiceDropAnsweredByToDeliveryOutcome("human")
assert.equal(humanOutcome.delivered, false)
assert.equal(humanOutcome.failureReason, "human_answered_no_voicemail_drop")

const playback = resolveVoiceDropPlayback({ voiceId: "Joanna" })
assert.equal(playback.mode, "say")
if (playback.mode === "say") {
  assert.match(playback.voice, /Joanna/)
}

const providerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/voice-drops/twilio-voice-drop-client.ts"),
  "utf8",
)
assert.match(providerSource, /machineDetection:\s*"DetectMessageEnd"/)
assert.match(providerSource, /client\.calls\.create/)

const scaffoldRemoved = !fs.existsSync(
  path.join(process.cwd(), "lib/voice/voice-drops/twilio-scaffold-provider.ts"),
)
assert.equal(scaffoldRemoved, true)

async function main() {
  const priorEnabled = process.env.VOICE_DROP_ENABLED
  const priorCertified = process.env.VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED
  const priorSid = process.env.TWILIO_ACCOUNT_SID
  const priorToken = process.env.TWILIO_AUTH_TOKEN
  const priorFrom = process.env.TWILIO_VOICE_FROM_NUMBER

  process.env.VOICE_DROP_ENABLED = "false"
  process.env.TWILIO_ACCOUNT_SID = "ACtest"
  process.env.TWILIO_AUTH_TOKEN = "token"
  process.env.TWILIO_VOICE_FROM_NUMBER = "+15551234567"

  const disabled = await twilioVoiceDropProvider.queueDelivery({
    organizationId: "org",
    campaignId: "camp",
    recipientId: "rec",
    phoneNumber: "+14155550199",
    renderedMessage: "Test",
  })
  assert.equal(disabled.status, "failed")
  assert.equal(disabled.failureReason, "voice_drop_disabled")

  process.env.VOICE_DROP_ENABLED = "true"
  process.env.VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED = "false"

  const notCertified = await twilioVoiceDropProvider.queueDelivery({
    organizationId: "org",
    campaignId: "camp",
    recipientId: "rec",
    phoneNumber: "+14155550199",
    renderedMessage: "Test",
  })
  assert.equal(notCertified.status, "failed")
  assert.equal(notCertified.failureReason, "twilio_outbound_not_certified")
  assert.match(notCertified.evidenceText, /VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED/)

  process.env.VOICE_DROP_ENABLED = priorEnabled
  process.env.VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED = priorCertified
  process.env.TWILIO_ACCOUNT_SID = priorSid
  process.env.TWILIO_AUTH_TOKEN = priorToken
  process.env.TWILIO_VOICE_FROM_NUMBER = priorFrom

  const routesExist =
    fs.existsSync(path.join(process.cwd(), "app/api/voice/webhooks/twilio/voice-drop/twiml/route.ts")) &&
    fs.existsSync(path.join(process.cwd(), "app/api/voice/webhooks/twilio/voice-drop/status/route.ts"))
  assert.equal(routesExist, true)

  console.log("voice-drop-twilio-vd-1a: all checks passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
