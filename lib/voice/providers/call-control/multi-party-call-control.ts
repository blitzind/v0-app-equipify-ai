import "server-only"

import type { VoiceProviderId } from "@/lib/voice/types"

export type MultiPartyProviderResult = {
  ok: boolean
  providerReference: string
  stubMode: boolean
  message: string
}

export interface VoiceMultiPartyCallControlProvider {
  readonly providerId: VoiceProviderId | "stub"
  createConference(input: {
    friendlyName: string
    voiceCallId: string
  }): Promise<MultiPartyProviderResult>
  addParticipant(input: {
    conferenceReference: string
    phoneNumber?: string
    clientIdentity?: string
    muted?: boolean
    hold?: boolean
  }): Promise<MultiPartyProviderResult>
  removeParticipant(input: {
    conferenceReference: string
    participantReference: string
  }): Promise<MultiPartyProviderResult>
  holdParticipant(input: {
    conferenceReference: string
    participantReference: string
    hold: boolean
  }): Promise<MultiPartyProviderResult>
  muteParticipant(input: {
    conferenceReference: string
    participantReference: string
    muted: boolean
  }): Promise<MultiPartyProviderResult>
  transferCall(input: {
    callReference: string
    targetPhoneNumber?: string
    targetClientIdentity?: string
    kind: "cold" | "warm" | "consult"
  }): Promise<MultiPartyProviderResult>
  cancelTransfer(input: { transferReference: string }): Promise<MultiPartyProviderResult>
  completeTransfer(input: {
    transferReference: string
    conferenceReference?: string
  }): Promise<MultiPartyProviderResult>
}

function stubReference(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}`
}

class StubMultiPartyCallControlProvider implements VoiceMultiPartyCallControlProvider {
  readonly providerId = "stub" as const

  async createConference(input: { friendlyName: string; voiceCallId: string }) {
    return {
      ok: true,
      providerReference: stubReference(`CF_STUB_${input.voiceCallId.slice(0, 8)}`),
      stubMode: true,
      message: "Stub conference created — configure Twilio credentials for live conferences.",
    }
  }

  async addParticipant(input: {
    conferenceReference: string
    phoneNumber?: string
    clientIdentity?: string
  }) {
    const target = input.clientIdentity || input.phoneNumber || "unknown"
    return {
      ok: true,
      providerReference: stubReference(`PA_STUB_${target.replace(/\W/g, "").slice(0, 12)}`),
      stubMode: true,
      message: "Stub participant added.",
    }
  }

  async removeParticipant(input: { conferenceReference: string; participantReference: string }) {
    return {
      ok: true,
      providerReference: input.participantReference,
      stubMode: true,
      message: "Stub participant removed.",
    }
  }

  async holdParticipant(input: { conferenceReference: string; participantReference: string; hold: boolean }) {
    return {
      ok: true,
      providerReference: input.participantReference,
      stubMode: true,
      message: input.hold ? "Stub participant placed on hold." : "Stub participant resumed.",
    }
  }

  async muteParticipant(input: {
    conferenceReference: string
    participantReference: string
    muted: boolean
  }) {
    return {
      ok: true,
      providerReference: input.participantReference,
      stubMode: true,
      message: input.muted ? "Stub participant muted." : "Stub participant unmuted.",
    }
  }

  async transferCall(input: {
    callReference: string
    targetPhoneNumber?: string
    targetClientIdentity?: string
    kind: "cold" | "warm" | "consult"
  }) {
    return {
      ok: true,
      providerReference: stubReference(`TR_STUB_${input.kind}`),
      stubMode: true,
      message: `${input.kind} transfer scaffold accepted (stub).`,
    }
  }

  async cancelTransfer(input: { transferReference: string }) {
    return {
      ok: true,
      providerReference: input.transferReference,
      stubMode: true,
      message: "Stub transfer canceled.",
    }
  }

  async completeTransfer(input: { transferReference: string; conferenceReference?: string }) {
    return {
      ok: true,
      providerReference: input.transferReference,
      stubMode: true,
      message: "Stub transfer completed.",
    }
  }
}

class TwilioMultiPartyCallControlProvider implements VoiceMultiPartyCallControlProvider {
  readonly providerId = "twilio" as const
  private stub = new StubMultiPartyCallControlProvider()

  private hasCredentials(): boolean {
    return Boolean(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim())
  }

  async createConference(input: { friendlyName: string; voiceCallId: string }) {
    if (!this.hasCredentials()) return this.stub.createConference(input)

    try {
      const twilio = await import("twilio")
      const client = twilio.default(
        process.env.TWILIO_ACCOUNT_SID!.trim(),
        process.env.TWILIO_AUTH_TOKEN!.trim(),
      )
      const conference = await client.conferences.create({
        friendlyName: input.friendlyName || `voice-${input.voiceCallId.slice(0, 8)}`,
        statusCallbackEvent: ["start", "end", "join", "leave"],
      })
      return {
        ok: true,
        providerReference: conference.sid,
        stubMode: false,
        message: "Twilio conference created.",
      }
    } catch (error) {
      return {
        ok: false,
        providerReference: "",
        stubMode: false,
        message: error instanceof Error ? error.message : "Twilio conference creation failed.",
      }
    }
  }

  async addParticipant(input: {
    conferenceReference: string
    phoneNumber?: string
    clientIdentity?: string
    muted?: boolean
    hold?: boolean
  }) {
    if (!this.hasCredentials()) return this.stub.addParticipant(input)
    if (!input.phoneNumber && !input.clientIdentity) {
      return { ok: false, providerReference: "", stubMode: false, message: "Participant target required." }
    }

    try {
      const twilio = await import("twilio")
      const client = twilio.default(
        process.env.TWILIO_ACCOUNT_SID!.trim(),
        process.env.TWILIO_AUTH_TOKEN!.trim(),
      )
      const fromNumber = process.env.TWILIO_VOICE_FROM_NUMBER?.trim() || process.env.TWILIO_PHONE_NUMBER?.trim()
      if (!fromNumber) {
        return {
          ok: false,
          providerReference: "",
          stubMode: false,
          message: "Set TWILIO_VOICE_FROM_NUMBER for conference participant dialing.",
        }
      }

      const participant = await client.conferences(input.conferenceReference).participants.create({
        from: fromNumber,
        to: input.clientIdentity ? `client:${input.clientIdentity}` : input.phoneNumber!,
        muted: input.muted,
        hold: input.hold,
      })

      return {
        ok: true,
        providerReference: participant.callSid,
        stubMode: false,
        message: "Twilio conference participant added.",
      }
    } catch (error) {
      return {
        ok: false,
        providerReference: "",
        stubMode: false,
        message: error instanceof Error ? error.message : "Twilio add participant failed.",
      }
    }
  }

  async removeParticipant(input: { conferenceReference: string; participantReference: string }) {
    if (!this.hasCredentials()) return this.stub.removeParticipant(input)
    try {
      const twilio = await import("twilio")
      const client = twilio.default(
        process.env.TWILIO_ACCOUNT_SID!.trim(),
        process.env.TWILIO_AUTH_TOKEN!.trim(),
      )
      await client.conferences(input.conferenceReference).participants(input.participantReference).remove()
      return {
        ok: true,
        providerReference: input.participantReference,
        stubMode: false,
        message: "Twilio participant removed.",
      }
    } catch (error) {
      return {
        ok: false,
        providerReference: input.participantReference,
        stubMode: false,
        message: error instanceof Error ? error.message : "Twilio remove participant failed.",
      }
    }
  }

  async holdParticipant(input: { conferenceReference: string; participantReference: string; hold: boolean }) {
    if (!this.hasCredentials()) return this.stub.holdParticipant(input)
    try {
      const twilio = await import("twilio")
      const client = twilio.default(
        process.env.TWILIO_ACCOUNT_SID!.trim(),
        process.env.TWILIO_AUTH_TOKEN!.trim(),
      )
      await client
        .conferences(input.conferenceReference)
        .participants(input.participantReference)
        .update({ hold: input.hold })
      return {
        ok: true,
        providerReference: input.participantReference,
        stubMode: false,
        message: input.hold ? "Participant placed on hold." : "Participant resumed.",
      }
    } catch (error) {
      return {
        ok: false,
        providerReference: input.participantReference,
        stubMode: false,
        message: error instanceof Error ? error.message : "Twilio hold update failed.",
      }
    }
  }

  async muteParticipant(input: {
    conferenceReference: string
    participantReference: string
    muted: boolean
  }) {
    if (!this.hasCredentials()) return this.stub.muteParticipant(input)
    try {
      const twilio = await import("twilio")
      const client = twilio.default(
        process.env.TWILIO_ACCOUNT_SID!.trim(),
        process.env.TWILIO_AUTH_TOKEN!.trim(),
      )
      await client
        .conferences(input.conferenceReference)
        .participants(input.participantReference)
        .update({ muted: input.muted })
      return {
        ok: true,
        providerReference: input.participantReference,
        stubMode: false,
        message: input.muted ? "Participant muted." : "Participant unmuted.",
      }
    } catch (error) {
      return {
        ok: false,
        providerReference: input.participantReference,
        stubMode: false,
        message: error instanceof Error ? error.message : "Twilio mute update failed.",
      }
    }
  }

  async transferCall(input: {
    callReference: string
    targetPhoneNumber?: string
    targetClientIdentity?: string
    kind: "cold" | "warm" | "consult"
  }) {
    if (!this.hasCredentials()) return this.stub.transferCall(input)
    if (!input.targetPhoneNumber && !input.targetClientIdentity) {
      return { ok: false, providerReference: "", stubMode: false, message: "Transfer target required." }
    }

    try {
      const twilio = await import("twilio")
      const client = twilio.default(
        process.env.TWILIO_ACCOUNT_SID!.trim(),
        process.env.TWILIO_AUTH_TOKEN!.trim(),
      )
      const target = input.targetClientIdentity
        ? `client:${input.targetClientIdentity}`
        : input.targetPhoneNumber!

      if (input.kind === "cold") {
        await client.calls(input.callReference).update({ twiml: `<Response><Dial>${target}</Dial></Response>` })
      } else {
        await client.calls(input.callReference).update({
          twiml: `<Response><Dial><Conference>${input.callReference.slice(-8)}</Conference></Dial></Response>`,
        })
      }

      return {
        ok: true,
        providerReference: stubReference(`TR_${input.kind}`),
        stubMode: false,
        message: `${input.kind} transfer initiated via Twilio.`,
      }
    } catch (error) {
      return {
        ok: false,
        providerReference: "",
        stubMode: false,
        message: error instanceof Error ? error.message : "Twilio transfer failed.",
      }
    }
  }

  async cancelTransfer(input: { transferReference: string }) {
    if (!this.hasCredentials()) return this.stub.cancelTransfer(input)
    return this.stub.cancelTransfer(input)
  }

  async completeTransfer(input: { transferReference: string; conferenceReference?: string }) {
    if (!this.hasCredentials()) return this.stub.completeTransfer(input)
    return this.stub.completeTransfer(input)
  }
}

const PROVIDERS: Record<string, VoiceMultiPartyCallControlProvider> = {
  stub: new StubMultiPartyCallControlProvider(),
  twilio: new TwilioMultiPartyCallControlProvider(),
}

export function createMultiPartyCallControlProvider(providerId?: VoiceProviderId): VoiceMultiPartyCallControlProvider {
  if (providerId && PROVIDERS[providerId]) return PROVIDERS[providerId]!
  if (process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim()) {
    return PROVIDERS.twilio!
  }
  return PROVIDERS.stub!
}

export function providerCreateConference(
  provider: VoiceMultiPartyCallControlProvider,
  input: Parameters<VoiceMultiPartyCallControlProvider["createConference"]>[0],
) {
  return provider.createConference(input)
}

export function providerAddParticipant(
  provider: VoiceMultiPartyCallControlProvider,
  input: Parameters<VoiceMultiPartyCallControlProvider["addParticipant"]>[0],
) {
  return provider.addParticipant(input)
}

export function providerRemoveParticipant(
  provider: VoiceMultiPartyCallControlProvider,
  input: Parameters<VoiceMultiPartyCallControlProvider["removeParticipant"]>[0],
) {
  return provider.removeParticipant(input)
}

export function providerHoldParticipant(
  provider: VoiceMultiPartyCallControlProvider,
  input: Parameters<VoiceMultiPartyCallControlProvider["holdParticipant"]>[0],
) {
  return provider.holdParticipant(input)
}

export function providerMuteParticipant(
  provider: VoiceMultiPartyCallControlProvider,
  input: Parameters<VoiceMultiPartyCallControlProvider["muteParticipant"]>[0],
) {
  return provider.muteParticipant(input)
}

export function providerTransferCall(
  provider: VoiceMultiPartyCallControlProvider,
  input: Parameters<VoiceMultiPartyCallControlProvider["transferCall"]>[0],
) {
  return provider.transferCall(input)
}

export function providerCancelTransfer(
  provider: VoiceMultiPartyCallControlProvider,
  input: Parameters<VoiceMultiPartyCallControlProvider["cancelTransfer"]>[0],
) {
  return provider.cancelTransfer(input)
}

export function providerCompleteTransfer(
  provider: VoiceMultiPartyCallControlProvider,
  input: Parameters<VoiceMultiPartyCallControlProvider["completeTransfer"]>[0],
) {
  return provider.completeTransfer(input)
}
