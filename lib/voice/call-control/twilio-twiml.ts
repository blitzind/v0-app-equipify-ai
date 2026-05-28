import type { InboundCallControlDecision } from "@/lib/voice/call-control/types"

export type TwilioCallControlVerbInput = {
  decision: InboundCallControlDecision
  callerId?: string
  recordingCallbackUrl?: string | null
  statusCallbackUrl?: string | null
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function buildTwilioSayAndHangup(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${xmlEscape(message)}</Say><Hangup/></Response>`
}

export function buildTwilioReject(): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="rejected"/></Response>`
}

export function forwardCallTwiml(input: { toNumber: string; callerId?: string; record?: boolean; recordingCallbackUrl?: string | null }): string {
  const attrs = [`callerId="${xmlEscape(input.callerId ?? "")}"`]
  if (input.record) {
    attrs.push('record="record-from-answer-dual"')
    if (input.recordingCallbackUrl) {
      attrs.push(`recordingStatusCallback="${xmlEscape(input.recordingCallbackUrl)}"`)
      attrs.push('recordingStatusCallbackMethod="POST"')
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial ${attrs.join(" ")}><Number>${xmlEscape(input.toNumber)}</Number></Dial></Response>`
}

export function dialMultipleTwiml(input: {
  numbers: string[]
  callerId?: string
  simultaneous?: boolean
  record?: boolean
  recordingCallbackUrl?: string | null
}): string {
  if (input.numbers.length === 0) {
    return buildTwilioSayAndHangup("No destination configured for this call.")
  }
  const attrs = [`callerId="${xmlEscape(input.callerId ?? "")}"`]
  if (input.simultaneous) attrs.push('sequential="false"')
  if (input.record) {
    attrs.push('record="record-from-answer-dual"')
    if (input.recordingCallbackUrl) {
      attrs.push(`recordingStatusCallback="${xmlEscape(input.recordingCallbackUrl)}"`)
      attrs.push('recordingStatusCallbackMethod="POST"')
    }
  }
  const numbers = input.numbers.map((n) => `<Number>${xmlEscape(n)}</Number>`).join("")
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial ${attrs.join(" ")}>${numbers}</Dial></Response>`
}

export function sendToVoicemailTwiml(input: {
  greetingText?: string
  record?: boolean
  recordingCallbackUrl?: string | null
  maxLengthSeconds?: number
}): string {
  const say = input.greetingText?.trim()
    ? `<Say>${xmlEscape(input.greetingText.trim())}</Say>`
    : `<Say>Please leave a message after the tone.</Say>`
  const recordAttrs = [
    'maxLength="120"',
    'playBeep="true"',
    'timeout="5"',
    'transcribe="false"',
  ]
  if (input.recordingCallbackUrl) {
    recordAttrs.push(`action="${xmlEscape(input.recordingCallbackUrl)}"`)
    recordAttrs.push('method="POST"')
  }
  if (input.maxLengthSeconds) {
    recordAttrs.push(`maxLength="${input.maxLengthSeconds}"`)
  }
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${say}<Record ${recordAttrs.join(" ")}/></Response>`
}

export function recordCallTwiml(input: { recordingCallbackUrl: string; disclosureText?: string | null }): string {
  const preamble = input.disclosureText?.trim()
    ? `<Say>${xmlEscape(input.disclosureText.trim())}</Say>`
    : ""
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${preamble}<Record recordingStatusCallback="${xmlEscape(input.recordingCallbackUrl)}" recordingStatusCallbackMethod="POST" maxLength="3600" playBeep="true"/></Response>`
}

export function generateInboundCallResponseTwiml(input: TwilioCallControlVerbInput): string {
  const { decision } = input
  const record = decision.recordingEnabled
  const recordingCallbackUrl = input.recordingCallbackUrl ?? null

  if (decision.recordingDisclosureText && record && decision.action !== "voicemail") {
    // Disclosure is handled inline for dial/forward via preamble in future; for now attach to dial record flag only.
  }

  switch (decision.action) {
    case "reject":
      return buildTwilioReject()
    case "say_and_hangup":
      return buildTwilioSayAndHangup(decision.fallbackReason ?? "This number is unavailable.")
    case "forward":
      return forwardCallTwiml({
        toNumber: decision.dialNumbers[0] ?? "",
        callerId: input.callerId,
        record,
        recordingCallbackUrl,
      })
    case "dial":
      return dialMultipleTwiml({
        numbers: decision.dialNumbers,
        callerId: input.callerId,
        simultaneous: decision.routingMode === "simultaneous_ring",
        record,
        recordingCallbackUrl,
      })
    case "voicemail":
      return sendToVoicemailTwiml({
        greetingText: decision.fallbackReason ?? undefined,
        record: true,
        recordingCallbackUrl,
      })
    default:
      return buildTwilioSayAndHangup("Unable to route this call.")
  }
}

export function rejectCallTwiml(): string {
  return buildTwilioReject()
}
