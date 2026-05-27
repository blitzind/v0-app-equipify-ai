export function webhookAsString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function pickWebhookOccurredAt(payload: Record<string, unknown>): string | undefined {
  const candidates = [
    payload.timestamp,
    payload.occurred_at,
    payload.occurredAt,
    payload.created_at,
    payload.createdAt,
    payload.eventTime,
    payload.time,
  ]
  for (const candidate of candidates) {
    const value = webhookAsString(candidate)
    if (value) return value
  }
  return undefined
}

export function mapWebhookEventType(raw: string): import("@/lib/growth/webhooks/webhook-types").GrowthNormalizedWebhookEventType {
  const lower = raw.toLowerCase()
  if (lower.includes("deliver") && !lower.includes("fail")) return "delivered"
  if (lower.includes("defer")) return "deferred"
  if (lower.includes("bounce") || lower.includes("reject")) return "bounced"
  if (lower.includes("complaint") || lower.includes("spam")) return "complained"
  if (lower.includes("unsub")) return "unsubscribed"
  if (lower.includes("open")) return "opened"
  if (lower.includes("click")) return "clicked"
  if (lower.includes("drop")) return "dropped"
  if (lower.includes("fail") || lower.includes("error")) return "failed"
  return "unknown"
}
