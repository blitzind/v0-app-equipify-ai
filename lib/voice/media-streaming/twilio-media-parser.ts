/** Twilio Media Streams frame parsing (pure, testable). */

export type TwilioMediaStreamStartPayload = {
  streamSid: string
  callSid: string
  accountSid?: string
  tracks?: string[]
  customParameters?: Record<string, string>
}

export type TwilioMediaStreamFrame =
  | { event: "connected"; protocol?: string; version?: string }
  | { event: "start"; start: TwilioMediaStreamStartPayload; streamSid?: string }
  | { event: "media"; streamSid?: string; media?: { track?: string; chunk?: string; timestamp?: string; payload?: string } }
  | { event: "mark"; streamSid?: string; mark?: { name?: string } }
  | { event: "stop"; streamSid?: string; stop?: { accountSid?: string; callSid?: string } }

export function parseTwilioMediaStreamMessage(raw: string): TwilioMediaStreamFrame | null {
  try {
    const parsed = JSON.parse(raw) as TwilioMediaStreamFrame
    if (!parsed || typeof parsed !== "object" || !("event" in parsed)) return null
    return parsed
  } catch {
    return null
  }
}
