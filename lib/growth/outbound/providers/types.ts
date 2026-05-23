import type {
  CanonicalOutboundEventType,
  NormalizedOutboundEvent,
  OutboundFixtureEnvelope,
} from "@/lib/growth/outbound/types"

export type ParsedWebhookEnvelope = OutboundFixtureEnvelope

export type VerifyWebhookResult = {
  ok: boolean
  mode: "verified" | "skipped" | "failed"
  message?: string
}

export interface OutboundProviderAdapter {
  providerKey(): string
  providerName(): string
  verifyWebhookSignature(input: {
    headers: Headers
    rawBody: string
    secret: string | null
  }): VerifyWebhookResult
  parseWebhookPayload(raw: unknown): ParsedWebhookEnvelope[]
  normalizeEvent(envelope: ParsedWebhookEnvelope): NormalizedOutboundEvent
}

export function envelopeToNormalized(envelope: OutboundFixtureEnvelope): NormalizedOutboundEvent {
  return {
    provider: envelope.provider,
    providerEventId: envelope.providerEventId,
    eventType: envelope.eventType,
    occurredAt: envelope.occurredAt,
    email: envelope.contact.email,
    providerContactId: envelope.contact.providerContactId ?? null,
    providerMessageId: envelope.message?.providerMessageId ?? envelope.reply?.inReplyToProviderMessageId ?? null,
    providerReplyId: envelope.reply?.providerReplyId ?? null,
    providerCampaignId: envelope.campaign?.providerCampaignId ?? null,
    campaignName: envelope.campaign?.name ?? envelope.message?.campaignName ?? null,
    subject: envelope.message?.subject ?? null,
    bodyPreview: envelope.reply?.bodyPreview ?? envelope.message?.bodyPreview ?? null,
    sequenceStep: envelope.message?.sequenceStep ?? null,
    inReplyToProviderMessageId: envelope.reply?.inReplyToProviderMessageId ?? null,
    bounceType: envelope.message?.bounceType ?? null,
    raw: envelope as unknown as Record<string, unknown>,
  }
}
