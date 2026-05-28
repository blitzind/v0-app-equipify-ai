import "server-only"

import type { VoiceBrowserCallingProvider, VoiceBrowserCallingProviderContext } from "@/lib/voice/browser-calling/provider-types"
import type { VoiceBrowserProviderId } from "@/lib/voice/browser-calling/types"

class StubVoiceBrowserCallingProvider implements VoiceBrowserCallingProvider {
  readonly providerId = "stub" as const

  async createAccessToken(input: VoiceBrowserCallingProviderContext) {
    return {
      provider: this.providerId,
      token: null,
      expiresAt: null,
      stubMode: true,
      message: `Stub browser calling for ${input.clientIdentity} — configure Twilio Voice SDK credentials for live WebRTC.`,
    }
  }

  validateRegistrationContext() {
    return { ok: true, message: "Stub browser calling registration accepted." }
  }
}

class TwilioVoiceBrowserCallingProvider implements VoiceBrowserCallingProvider {
  readonly providerId = "twilio" as const

  async createAccessToken(input: VoiceBrowserCallingProviderContext) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
    const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim()
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim()
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID?.trim()

    if (!accountSid || !authToken) {
      return {
        provider: this.providerId,
        token: null,
        expiresAt: null,
        stubMode: true,
        message: "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN for browser calling tokens.",
      }
    }

    if (!twimlAppSid) {
      return {
        provider: this.providerId,
        token: null,
        expiresAt: null,
        stubMode: true,
        message: "Set TWILIO_TWIML_APP_SID for outbound browser calling.",
      }
    }

    try {
      const twilio = await import("twilio")
      const AccessToken = twilio.jwt.AccessToken
      const VoiceGrant = AccessToken.VoiceGrant

      const token = new AccessToken(
        accountSid,
        apiKeySid || accountSid,
        apiKeySecret || authToken,
        { identity: input.clientIdentity, ttl: 3600 },
      )

      const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        incomingAllow: true,
      })
      token.addGrant(voiceGrant)

      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()
      return {
        provider: this.providerId,
        token: token.toJwt(),
        expiresAt,
        stubMode: false,
        message: "Twilio Voice SDK access token issued.",
      }
    } catch (error) {
      return {
        provider: this.providerId,
        token: null,
        expiresAt: null,
        stubMode: true,
        message: error instanceof Error ? error.message : "Could not mint Twilio browser token.",
      }
    }
  }

  validateRegistrationContext(input: VoiceBrowserCallingProviderContext) {
    if (!input.clientIdentity.startsWith("org_")) {
      return { ok: false, message: "Invalid browser client identity." }
    }
    return { ok: true, message: "Twilio browser registration context valid." }
  }
}

const PROVIDERS: Record<VoiceBrowserProviderId, VoiceBrowserCallingProvider> = {
  stub: new StubVoiceBrowserCallingProvider(),
  twilio: new TwilioVoiceBrowserCallingProvider(),
  telnyx: new StubVoiceBrowserCallingProvider(),
  sip: new StubVoiceBrowserCallingProvider(),
}

export function resolveVoiceBrowserCallingProvider(providerId?: VoiceBrowserProviderId): VoiceBrowserCallingProvider {
  if (providerId && PROVIDERS[providerId]) return PROVIDERS[providerId]
  const configured = process.env.VOICE_BROWSER_CALLING_PROVIDER?.trim() as VoiceBrowserProviderId | undefined
  if (configured && PROVIDERS[configured]) return PROVIDERS[configured]
  if (process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_TWIML_APP_SID?.trim()) {
    return PROVIDERS.twilio
  }
  return PROVIDERS.stub
}

export function listVoiceBrowserCallingProviders(): VoiceBrowserProviderId[] {
  return Object.keys(PROVIDERS) as VoiceBrowserProviderId[]
}
