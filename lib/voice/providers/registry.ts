import type { VoiceProviderId } from "@/lib/voice/types"
import { VOICE_PROVIDER_ABSTRACTION_QA_MARKER } from "@/lib/voice/types"
import { createTwilioVoiceProvider } from "@/lib/voice/providers/twilio-provider"
import type { VoiceTelephonyProvider } from "@/lib/voice/providers/types"

export { VOICE_PROVIDER_ABSTRACTION_QA_MARKER }

const stubProvider: VoiceTelephonyProvider = {
  providerId: "stub",
  async provisionNumber() {
    return { ok: false, message: "Stub provider cannot provision numbers." }
  },
  async releaseNumber() {
    return { ok: false, message: "Stub provider cannot release numbers." }
  },
  async initiateCall(input) {
    return {
      ok: true,
      providerCallId: `stub:${input.organizationId}:${Date.now()}`,
      message: "Stub call reference created (no telephony).",
    }
  },
  async fetchCall(providerCallId) {
    return { ok: true, providerCallId, status: "completed" }
  },
  async listNumbers() {
    return { ok: true, numbers: [] }
  },
  async sendSms() {
    return { ok: false, message: "Stub provider cannot send SMS." }
  },
  async validateWebhook() {
    return { ok: true, message: "Stub webhook validation skipped." }
  },
  normalizeWebhookEvent(payload) {
    const callSid = typeof payload.CallSid === "string" ? payload.CallSid : null
    if (!callSid) return null
    return {
      provider: "stub",
      providerCallId: callSid,
      eventType: typeof payload.CallStatus === "string" ? payload.CallStatus : "unknown",
      eventTimestamp: new Date().toISOString(),
      direction: null,
      fromNumber: null,
      toNumber: null,
      providerStatus: typeof payload.CallStatus === "string" ? payload.CallStatus : null,
      recordingAvailable: false,
      payload,
    }
  },
}

export function createVoiceProviderInstance(providerId: VoiceProviderId): VoiceTelephonyProvider {
  switch (providerId) {
    case "twilio":
      return createTwilioVoiceProvider()
    case "stub":
      return stubProvider
    case "telnyx":
    case "plivo":
    case "sip":
      return {
        ...stubProvider,
        providerId,
        async provisionNumber() {
          return { ok: false, message: `${providerId} provider scaffold not configured yet.` }
        },
        async validateWebhook() {
          return { ok: false, message: `${providerId} webhook validation not configured yet.` }
        },
        normalizeWebhookEvent(payload) {
          const event = stubProvider.normalizeWebhookEvent(payload)
          return event ? { ...event, provider: providerId } : null
        },
      }
    default:
      return stubProvider
  }
}

export function listRegisteredVoiceProviders(): VoiceProviderId[] {
  return ["twilio", "telnyx", "plivo", "sip", "stub"]
}
