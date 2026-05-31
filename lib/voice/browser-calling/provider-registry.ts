import "server-only"

import type { VoiceBrowserCallingProvider, VoiceBrowserCallingProviderContext } from "@/lib/voice/browser-calling/provider-types"
import {
  mintTwilioVoiceBrowserAccessToken,
  readTwilioBrowserTokenEnv,
} from "@/lib/voice/browser-calling/twilio-browser-access-token"
import {
  buildVoiceBrowserTokenMintDiagnostics,
  type VoiceBrowserTokenMintDiagnostics,
} from "@/lib/voice/browser-calling/token-diagnostics"
import type { VoiceBrowserProviderId } from "@/lib/voice/browser-calling/types"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

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

  private logTokenMintDiagnostics(
    input: VoiceBrowserCallingProviderContext,
    diagnostics: VoiceBrowserTokenMintDiagnostics,
    stubMode: boolean,
  ): void {
    logVoiceInfrastructure("voice_browser_token_mint_diagnostics", {
      organizationId: input.organizationId,
      userId: input.userId,
      clientIdentity: input.clientIdentity,
      provider: this.providerId,
      stubMode,
      accountSidMask: diagnostics.accountSidMask,
      apiKeySidMask: diagnostics.apiKeySidMask,
      twimlAppSidMask: diagnostics.twimlAppSidMask,
      apiKeySecretFingerprint: diagnostics.apiKeySecretFingerprint,
      identity: diagnostics.identity,
      grantTypes: diagnostics.grantTypes,
      tokenIssuerSid: diagnostics.tokenIssuerSid,
      tokenSubjectSid: diagnostics.tokenSubjectSid,
      voiceGrantIncomingAllow: diagnostics.voiceGrantIncomingAllow,
      voiceGrantOutgoingApplicationSid: diagnostics.voiceGrantOutgoingApplicationSid,
      signingKeySidPrefixValid: diagnostics.signingKeySidPrefixValid,
      signingCredentialSource: diagnostics.signingCredentialSource,
    })
  }

  async createAccessToken(input: VoiceBrowserCallingProviderContext) {
    const env = readTwilioBrowserTokenEnv()
    const { accountSid, authToken, apiKeySid, apiKeySecret, twimlAppSid } = env

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

    if (!apiKeySid || !apiKeySecret) {
      const diagnostics = buildVoiceBrowserTokenMintDiagnostics({
        accountSid,
        apiKeySid,
        apiKeySecret,
        twimlAppSid,
        identity: input.clientIdentity,
        jwt: null,
      })
      this.logTokenMintDiagnostics(input, diagnostics, true)
      return {
        provider: this.providerId,
        token: null,
        expiresAt: null,
        stubMode: true,
        message:
          "Set TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET for browser Voice SDK tokens. Account SID and auth token cannot sign valid access tokens (Twilio error 31204).",
      }
    }

    if (!apiKeySid.startsWith("SK")) {
      const diagnostics = buildVoiceBrowserTokenMintDiagnostics({
        accountSid,
        apiKeySid,
        apiKeySecret,
        twimlAppSid,
        identity: input.clientIdentity,
        jwt: null,
      })
      this.logTokenMintDiagnostics(input, diagnostics, true)
      return {
        provider: this.providerId,
        token: null,
        expiresAt: null,
        stubMode: true,
        message:
          "TWILIO_API_KEY_SID must be an API Key SID (SK...) for browser Voice SDK tokens. Using Account SID as issuer causes Twilio error 31204 (JWT is invalid).",
      }
    }

    try {
      const jwt = await mintTwilioVoiceBrowserAccessToken({
        accountSid,
        apiKeySid,
        apiKeySecret,
        twimlAppSid,
        identity: input.clientIdentity,
        ttlSeconds: 3600,
      })
      const diagnostics = buildVoiceBrowserTokenMintDiagnostics({
        accountSid,
        apiKeySid,
        apiKeySecret,
        twimlAppSid,
        identity: input.clientIdentity,
        jwt,
      })
      this.logTokenMintDiagnostics(input, diagnostics, false)

      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()
      return {
        provider: this.providerId,
        token: jwt,
        expiresAt,
        stubMode: false,
        message: "Twilio Voice SDK access token issued.",
      }
    } catch (error) {
      const diagnostics = buildVoiceBrowserTokenMintDiagnostics({
        accountSid,
        apiKeySid,
        apiKeySecret,
        twimlAppSid,
        identity: input.clientIdentity,
        jwt: null,
      })
      this.logTokenMintDiagnostics(input, diagnostics, true)
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
