import type { VoiceCallDirection } from "@/lib/voice/types"
import type { InboundCallControlDecision } from "@/lib/voice/call-control/types"
import {
  dialMultipleTwiml,
  forwardCallTwiml,
  generateInboundCallResponseTwiml,
  recordCallTwiml,
  rejectCallTwiml,
  sendToVoicemailTwiml,
} from "@/lib/voice/call-control/twilio-twiml"

export type VoiceCallControlResponse = {
  contentType: "application/xml"
  body: string
}

export interface VoiceCallControlProvider {
  readonly providerId: "twilio" | "stub"
  generateInboundCallResponse(input: {
    decision: InboundCallControlDecision
    callerId?: string
    recordingCallbackUrl?: string | null
    statusCallbackUrl?: string | null
  }): VoiceCallControlResponse
  forwardCall(input: {
    toNumber: string
    callerId?: string
    record?: boolean
    recordingCallbackUrl?: string | null
  }): VoiceCallControlResponse
  sendToVoicemail(input: {
    greetingText?: string
    recordingCallbackUrl?: string | null
  }): VoiceCallControlResponse
  recordCall(input: { recordingCallbackUrl: string; disclosureText?: string | null }): VoiceCallControlResponse
  rejectCall(): VoiceCallControlResponse
}

export function createTwilioCallControlProvider(): VoiceCallControlProvider {
  return {
    providerId: "twilio",
    generateInboundCallResponse(input) {
      return {
        contentType: "application/xml",
        body: generateInboundCallResponseTwiml(input),
      }
    },
    forwardCall(input) {
      return {
        contentType: "application/xml",
        body: forwardCallTwiml(input),
      }
    },
    sendToVoicemail(input) {
      return {
        contentType: "application/xml",
        body: sendToVoicemailTwiml({ ...input, record: true }),
      }
    },
    recordCall(input) {
      return {
        contentType: "application/xml",
        body: recordCallTwiml(input),
      }
    },
    rejectCall() {
      return {
        contentType: "application/xml",
        body: rejectCallTwiml(),
      }
    },
  }
}

export function createStubCallControlProvider(): VoiceCallControlProvider {
  return createTwilioCallControlProvider()
}

export function resolveRecordingForDirection(input: {
  enabled: boolean
  direction: VoiceCallDirection
}): boolean {
  return input.enabled && input.direction === "inbound"
}

/** Convenience export matching spec naming. */
export function generateInboundCallResponse(
  provider: VoiceCallControlProvider,
  input: Parameters<VoiceCallControlProvider["generateInboundCallResponse"]>[0],
): VoiceCallControlResponse {
  return provider.generateInboundCallResponse(input)
}

export function forwardCall(
  provider: VoiceCallControlProvider,
  input: Parameters<VoiceCallControlProvider["forwardCall"]>[0],
): VoiceCallControlResponse {
  return provider.forwardCall(input)
}

export function sendToVoicemail(
  provider: VoiceCallControlProvider,
  input: Parameters<VoiceCallControlProvider["sendToVoicemail"]>[0],
): VoiceCallControlResponse {
  return provider.sendToVoicemail(input)
}

export function recordCall(
  provider: VoiceCallControlProvider,
  input: Parameters<VoiceCallControlProvider["recordCall"]>[0],
): VoiceCallControlResponse {
  return provider.recordCall(input)
}

export function rejectCall(provider: VoiceCallControlProvider): VoiceCallControlResponse {
  return provider.rejectCall()
}

/** Exported for tests — simultaneous ring helper. */
export { dialMultipleTwiml }
