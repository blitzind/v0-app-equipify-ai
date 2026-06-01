import type { InboundCallControlDecision } from "@/lib/voice/call-control/types"

export type InboundDialMediaStreamTwimlInput = {
  wssUrl: string
  callSid?: string | null
}

export type TwilioCallControlVerbInput = {
  decision: InboundCallControlDecision
  callerId?: string
  recordingCallbackUrl?: string | null
  statusCallbackUrl?: string | null
  /** Prepends `<Start><Stream>` inside `<Response>` for live transcript ingestion. */
  mediaStream?: InboundDialMediaStreamTwimlInput | null
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

export function buildMediaStreamStartTwimlFragment(input: {
  wssUrl: string
  callSid?: string | null
  track?: "inbound_track" | "outbound_track" | "both_tracks"
}): string {
  const streamUrl = xmlEscape(input.wssUrl)
  const track = input.track ?? "both_tracks"
  const callSidParam = input.callSid
    ? `<Parameter name="callSid" value="${xmlEscape(input.callSid)}" />`
    : ""
  return `<Start><Stream url="${streamUrl}" track="${track}">${callSidParam}</Stream></Start>`
}

export function injectInboundDialMediaStreamTwiml(
  twiml: string,
  mediaStream?: InboundDialMediaStreamTwimlInput | null,
): string {
  if (!mediaStream?.wssUrl?.trim()) return twiml
  const fragment = buildMediaStreamStartTwimlFragment({
    wssUrl: mediaStream.wssUrl.trim(),
    callSid: mediaStream.callSid,
  })
  return twiml.replace("<Response>", `<Response>${fragment}`)
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
  clientIdentities?: string[]
  callerId?: string
  simultaneous?: boolean
  record?: boolean
  recordingCallbackUrl?: string | null
}): string {
  const clients = input.clientIdentities ?? []
  if (input.numbers.length === 0 && clients.length === 0) {
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
  const clientTags = clients.map((c) => `<Client>${xmlEscape(c)}</Client>`).join("")
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial ${attrs.join(" ")}>${clientTags}${numbers}</Dial></Response>`
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

export function buildAiReceptionistTwiml(input: {
  greetingText: string
  mediaStreamUrl?: string | null
  recordingDisclosureText?: string | null
  gatherActionUrl?: string | null
}): string {
  const preamble = input.recordingDisclosureText?.trim()
    ? `<Say>${xmlEscape(input.recordingDisclosureText.trim())}</Say>`
    : ""
  const greeting = `<Say>${xmlEscape(input.greetingText)}</Say>`
  const stream =
    input.mediaStreamUrl?.trim()
      ? `<Connect><Stream url="${xmlEscape(input.mediaStreamUrl.trim())}" /></Connect>`
      : ""
  const gather = input.gatherActionUrl
    ? `<Gather input="speech" speechTimeout="auto" action="${xmlEscape(input.gatherActionUrl)}" method="POST"><Say>How can I help you?</Say></Gather>`
    : ""
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${preamble}${greeting}${stream}${gather}</Response>`
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
      return injectInboundDialMediaStreamTwiml(
        forwardCallTwiml({
          toNumber: decision.dialNumbers[0] ?? "",
          callerId: input.callerId,
          record,
          recordingCallbackUrl,
        }),
        input.mediaStream,
      )
    case "dial":
      return injectInboundDialMediaStreamTwiml(
        dialMultipleTwiml({
          numbers: decision.dialNumbers,
          clientIdentities: decision.dialClientIdentities ?? [],
          callerId: input.callerId,
          simultaneous: decision.routingMode === "simultaneous_ring",
          record,
          recordingCallbackUrl,
        }),
        input.mediaStream,
      )
    case "voicemail":
      return sendToVoicemailTwiml({
        greetingText: decision.fallbackReason ?? undefined,
        record: true,
        recordingCallbackUrl,
      })
    case "ai_receptionist":
      return buildAiReceptionistTwiml({
        greetingText:
          decision.fallbackReason ??
          "Thank you for calling. This call is assisted by our automated receptionist. How can I help you today?",
        mediaStreamUrl: process.env.VOICE_MEDIA_STREAM_PUBLIC_ORIGIN
          ? `${process.env.VOICE_MEDIA_STREAM_PUBLIC_ORIGIN.replace(/\/$/, "")}/api/voice/media/twilio`
          : null,
        recordingDisclosureText: decision.recordingDisclosureText,
      })
    default:
      return buildTwilioSayAndHangup("Unable to route this call.")
  }
}

export function rejectCallTwiml(): string {
  return buildTwilioReject()
}
