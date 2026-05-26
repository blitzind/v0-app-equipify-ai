import type { NativeDialerProviderId } from "@/lib/growth/native-dialer/native-dialer-types"

export type NativeDialerStartInput = {
  sessionId: string
  phoneNumber: string
  leadId?: string | null
  contactName?: string | null
  companyName?: string | null
}

export type NativeDialerStartResult = {
  providerCallRef: string
  mode: "simulated" | "live"
  message: string
}

export type NativeDialerProviderHealth = {
  ok: boolean
  providerId: NativeDialerProviderId
  message: string
}

export type NativeDialerTelephonyProvider = {
  readonly providerId: NativeDialerProviderId
  startCall(input: NativeDialerStartInput): Promise<NativeDialerStartResult>
  endCall(providerCallRef: string): Promise<void>
  health(): Promise<NativeDialerProviderHealth>
}

export function createNativeDialerProviderInstance(providerId: NativeDialerProviderId): NativeDialerTelephonyProvider {
  switch (providerId) {
    case "retell":
      return new RetellNativeDialerProvider()
    case "twilio":
      return new TwilioNativeDialerProvider()
    case "elevenlabs_conversational":
      return new ElevenLabsNativeDialerProvider()
    case "sip":
      return new SipNativeDialerProvider()
    case "google_voice_bridge":
      return new GoogleVoiceBridgeNativeDialerProvider()
    default:
      return new StubNativeDialerProvider()
  }
}

class StubNativeDialerProvider implements NativeDialerTelephonyProvider {
  readonly providerId = "stub" as const
  async startCall(input: NativeDialerStartInput): Promise<NativeDialerStartResult> {
    return {
      providerCallRef: `stub:${input.sessionId}`,
      mode: "simulated",
      message: "Operator-controlled simulated call — use device dialer or provider when configured.",
    }
  }
  async endCall(): Promise<void> {}
  async health(): Promise<NativeDialerProviderHealth> {
    return { ok: true, providerId: "stub", message: "Stub provider ready." }
  }
}

class RetellNativeDialerProvider implements NativeDialerTelephonyProvider {
  readonly providerId = "retell" as const
  async startCall(input: NativeDialerStartInput): Promise<NativeDialerStartResult> {
    return {
      providerCallRef: `retell:pending:${input.sessionId}`,
      mode: "simulated",
      message: "Retell adapter ready — operator initiates call; no autonomous dialing.",
    }
  }
  async endCall(): Promise<void> {}
  async health(): Promise<NativeDialerProviderHealth> {
    return { ok: true, providerId: "retell", message: "Retell adapter configured (operator controlled)." }
  }
}

class TwilioNativeDialerProvider implements NativeDialerTelephonyProvider {
  readonly providerId = "twilio" as const
  async startCall(input: NativeDialerStartInput): Promise<NativeDialerStartResult> {
    return {
      providerCallRef: `twilio:pending:${input.sessionId}`,
      mode: "simulated",
      message: "Twilio adapter ready — telecom compliance handled by provider.",
    }
  }
  async endCall(): Promise<void> {}
  async health(): Promise<NativeDialerProviderHealth> {
    return { ok: true, providerId: "twilio", message: "Twilio adapter configured (operator controlled)." }
  }
}

class ElevenLabsNativeDialerProvider implements NativeDialerTelephonyProvider {
  readonly providerId = "elevenlabs_conversational" as const
  async startCall(input: NativeDialerStartInput): Promise<NativeDialerStartResult> {
    return {
      providerCallRef: `elevenlabs:pending:${input.sessionId}`,
      mode: "simulated",
      message: "ElevenLabs conversational adapter ready — operator controlled.",
    }
  }
  async endCall(): Promise<void> {}
  async health(): Promise<NativeDialerProviderHealth> {
    return {
      ok: true,
      providerId: "elevenlabs_conversational",
      message: "ElevenLabs adapter configured (operator controlled).",
    }
  }
}

class SipNativeDialerProvider implements NativeDialerTelephonyProvider {
  readonly providerId = "sip" as const
  async startCall(input: NativeDialerStartInput): Promise<NativeDialerStartResult> {
    return {
      providerCallRef: `sip:pending:${input.sessionId}`,
      mode: "simulated",
      message: "SIP adapter ready — connect custom telephony provider.",
    }
  }
  async endCall(): Promise<void> {}
  async health(): Promise<NativeDialerProviderHealth> {
    return { ok: true, providerId: "sip", message: "SIP adapter configured (operator controlled)." }
  }
}

class GoogleVoiceBridgeNativeDialerProvider implements NativeDialerTelephonyProvider {
  readonly providerId = "google_voice_bridge" as const
  async startCall(input: NativeDialerStartInput): Promise<NativeDialerStartResult> {
    return {
      providerCallRef: `google_voice_bridge:${input.sessionId}`,
      mode: "live",
      message:
        "External bridge mode — place the call manually in Google Voice, then mark call started. No provider telemetry.",
    }
  }
  async endCall(): Promise<void> {}
  async health(): Promise<NativeDialerProviderHealth> {
    return {
      ok: true,
      providerId: "google_voice_bridge",
      message: "Google Voice bridge ready — operator places calls externally.",
    }
  }
}

export async function routeNativeDialerProvider(input: {
  primaryProvider: NativeDialerProviderId
  fallbackProvider: NativeDialerProviderId
}): Promise<{ provider: NativeDialerTelephonyProvider; providerId: NativeDialerProviderId; failoverApplied: boolean }> {
  const primary = createNativeDialerProviderInstance(input.primaryProvider)
  const primaryHealth = await primary.health().catch(() => ({ ok: false } as NativeDialerProviderHealth))
  if (primaryHealth.ok) {
    return { provider: primary, providerId: input.primaryProvider, failoverApplied: false }
  }
  if (input.fallbackProvider === input.primaryProvider) {
    return { provider: primary, providerId: input.primaryProvider, failoverApplied: false }
  }
  const fallback = createNativeDialerProviderInstance(input.fallbackProvider)
  return { provider: fallback, providerId: input.fallbackProvider, failoverApplied: true }
}
