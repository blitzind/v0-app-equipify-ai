/** Client-safe Lemlist webhook event mapping (Growth Engine slice 6.15A). */

import type {
  CanonicalOutboundEventType,
  OutboundFixtureEnvelope,
} from "@/lib/growth/outbound/types"

const LEMLIST_WEBHOOK_EVENT_TYPES = [
  "contacted",
  "hooked",
  "attracted",
  "warmed",
  "interested",
  "notInterested",
  "emailsSent",
  "emailsOpened",
  "emailsClicked",
  "emailsReplied",
  "emailsBounced",
  "emailsUnsubscribed",
  "meetingBooked",
  "meetingsBooked",
  "unsubscribed",
  "bounced",
] as const

export type LemlistWebhookEventType = (typeof LEMLIST_WEBHOOK_EVENT_TYPES)[number]

export function isLemlistWebhookPayload(raw: unknown): raw is Record<string, unknown> {
  return Boolean(raw && typeof raw === "object" && !Array.isArray(raw))
}

export function lemlistWebhookProviderEventId(payload: Record<string, unknown>): string | null {
  const id = payload._id ?? payload.id ?? payload.activityId
  return typeof id === "string" && id.trim() ? id.trim() : null
}

export function mapLemlistWebhookEventType(type: string): CanonicalOutboundEventType {
  const normalized = type.trim()
  if (normalized === "contacted" || normalized === "emailsSent") return "sent"
  if (normalized === "hooked" || normalized === "emailsOpened") return "opened"
  if (normalized === "attracted" || normalized === "emailsClicked") return "clicked"
  if (
    normalized === "warmed" ||
    normalized === "emailsReplied" ||
    normalized === "interested" ||
    normalized === "notInterested" ||
    normalized === "meetingBooked" ||
    normalized === "meetingsBooked"
  ) {
    return "replied"
  }
  if (normalized === "bounced" || normalized === "emailsBounced") return "bounced"
  if (normalized === "unsubscribed" || normalized === "emailsUnsubscribed") return "unsubscribed"
  return "failed"
}

export function lemlistWebhookBodyPreview(payload: Record<string, unknown>, eventType: string): string | null {
  if (typeof payload.text === "string" && payload.text.trim()) {
    return payload.text.trim().slice(0, 500)
  }
  if (eventType === "interested") return "Lead marked interested in Lemlist."
  if (eventType === "notInterested") return "Lead marked not interested in Lemlist."
  if (eventType === "meetingBooked" || eventType === "meetingsBooked") return "Meeting booked in Lemlist."
  if (typeof payload.errorMessage === "string" && payload.errorMessage.trim()) {
    return payload.errorMessage.trim().slice(0, 500)
  }
  return null
}

export function lemlistWebhookBounceType(payload: Record<string, unknown>, eventType: string): "hard" | "soft" | null {
  if (eventType !== "bounced" && eventType !== "emailsBounced") return null
  const message = `${payload.errorMessage ?? ""}`.toLowerCase()
  if (message.includes("hard")) return "hard"
  return "hard"
}

export function lemlistWebhookToEnvelope(payload: Record<string, unknown>): OutboundFixtureEnvelope | null {
  const providerEventId = lemlistWebhookProviderEventId(payload)
  const typeRaw = typeof payload.type === "string" ? payload.type : ""
  const email =
    typeof payload.leadEmail === "string"
      ? payload.leadEmail
      : typeof payload.email === "string"
        ? payload.email
        : null
  if (!providerEventId || !typeRaw || !email) return null

  const eventType = mapLemlistWebhookEventType(typeRaw)
  const occurredAt =
    typeof payload.createdAt === "string" && payload.createdAt
      ? payload.createdAt
      : new Date().toISOString()

  return {
    provider: "lemlist",
    providerEventId,
    eventType,
    occurredAt,
    contact: {
      email,
      providerContactId:
        typeof payload.leadId === "string"
          ? payload.leadId
          : typeof payload.contactId === "string"
            ? payload.contactId
            : undefined,
      firstName: typeof payload.leadFirstName === "string" ? payload.leadFirstName : undefined,
      lastName: typeof payload.leadLastName === "string" ? payload.leadLastName : undefined,
    },
    message: {
      providerMessageId:
        typeof payload.emailId === "string"
          ? payload.emailId
          : typeof payload.messageId === "string"
            ? payload.messageId
            : undefined,
      subject: typeof payload.subject === "string" ? payload.subject : undefined,
      bodyPreview: lemlistWebhookBodyPreview(payload, typeRaw) ?? undefined,
      sequenceStep: typeof payload.sequenceStep === "number" ? payload.sequenceStep : undefined,
      campaignName: typeof payload.campaignName === "string" ? payload.campaignName : undefined,
      bounceType: lemlistWebhookBounceType(payload, typeRaw) ?? undefined,
    },
    reply:
      eventType === "replied"
        ? {
            providerReplyId: providerEventId,
            bodyPreview: lemlistWebhookBodyPreview(payload, typeRaw) ?? undefined,
            inReplyToProviderMessageId:
              typeof payload.emailId === "string"
                ? payload.emailId
                : typeof payload.messageId === "string"
                  ? payload.messageId
                  : undefined,
          }
        : undefined,
    campaign: {
      providerCampaignId: typeof payload.campaignId === "string" ? payload.campaignId : undefined,
      name: typeof payload.campaignName === "string" ? payload.campaignName : undefined,
    },
  }
}

export function parseLemlistWebhookPayload(raw: unknown): OutboundFixtureEnvelope[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => {
      if (!isLemlistWebhookPayload(entry)) return []
      const envelope = lemlistWebhookToEnvelope(entry)
      return envelope ? [envelope] : []
    })
  }
  if (!isLemlistWebhookPayload(raw)) return []
  const envelope = lemlistWebhookToEnvelope(raw)
  return envelope ? [envelope] : []
}

export function verifyLemlistWebhookSecret(input: {
  secret: string | null
  headers: Headers
  payload: Record<string, unknown>
  querySecret?: string | null
}): { ok: boolean; mode: "verified" | "failed" | "skipped"; message?: string } {
  if (!input.secret) {
    return { ok: false, mode: "failed", message: "Webhook secret is not configured for this connection." }
  }

  const headerSecret = input.headers.get("x-growth-webhook-secret") ?? input.headers.get("x-lemlist-secret")
  const payloadSecret = typeof input.payload.secret === "string" ? input.payload.secret : null
  const querySecret = input.querySecret?.trim() || null

  if (headerSecret === input.secret || payloadSecret === input.secret || querySecret === input.secret) {
    return { ok: true, mode: "verified" }
  }

  return { ok: false, mode: "failed", message: "Webhook secret verification failed." }
}
