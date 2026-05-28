import "server-only"

import { createHash } from "node:crypto"

export function voicePayloadSha256(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

export function sanitizeVoiceWebhookPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set(["auth_token", "account_sid", "api_secret", "password", "token"])
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (blocked.has(key.toLowerCase())) {
      out[key] = "[redacted]"
      continue
    }
    out[key] = value
  }
  return out
}

export function buildVoiceWebhookIdempotencyKey(input: {
  provider: string
  providerCallId: string
  eventType: string
  eventTimestamp: string
}): string {
  return `${input.provider}:${input.providerCallId}:${input.eventType}:${input.eventTimestamp}`
}
