/** Client-safe Twilio SMS payload helpers (Phase 5.1). */

export function parseTwilioFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {}
  for (const [key, value] of new URLSearchParams(body)) {
    params[key] = value
  }
  return params
}

export function normalizeTwilioSmsStatus(status: string | null | undefined): string {
  const normalized = (status ?? "").trim().toLowerCase()
  if (normalized === "delivered") return "delivered"
  if (normalized === "sent") return "sent"
  if (normalized === "failed" || normalized === "undelivered") return "undelivered"
  if (normalized === "queued" || normalized === "accepted" || normalized === "sending") return "sent"
  return normalized || "unknown"
}

export function isTwilioInboundSmsPayload(params: Record<string, string>): boolean {
  return Boolean(params.Body && params.From && params.To)
}

export function isTwilioSmsStatusPayload(params: Record<string, string>): boolean {
  return Boolean(params.MessageStatus && params.MessageSid)
}
