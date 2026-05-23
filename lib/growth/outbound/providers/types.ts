import type {
  CanonicalOutboundEventType,
  GrowthOutboundProviderFamily,
  NormalizedOutboundEvent,
  OutboundFixtureEnvelope,
} from "@/lib/growth/outbound/types"
import type {
  GrowthProviderCapabilitySnapshot,
  GrowthProviderValidationWarning,
} from "@/lib/growth/outbound/provider-types"
import type { GrowthEmailProviderConnection } from "@/lib/growth/outbound/types"

export type ParsedWebhookEnvelope = OutboundFixtureEnvelope

export type VerifyWebhookResult = {
  ok: boolean
  mode: "verified" | "skipped" | "failed"
  message?: string
}

export type GrowthProviderValidationResult = {
  healthy: boolean
  warnings: GrowthProviderValidationWarning[]
  supportedCapabilities: GrowthProviderCapabilitySnapshot
  accountMetadata: Record<string, unknown>
  temporarilyDegraded?: boolean
  degradedReason?: string | null
  degradedUntil?: string | null
}

export interface OutboundProviderAdapter {
  providerKey(): string
  providerName(): string
  providerFamily(): GrowthOutboundProviderFamily
  declaredCapabilities(): GrowthProviderCapabilitySnapshot
  validateConnection(input: {
    connection: GrowthEmailProviderConnection
    credentials: Record<string, unknown> | null
  }): Promise<GrowthProviderValidationResult>
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
