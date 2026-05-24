/** Client-safe Growth Engine outbound types. */

export const GROWTH_OUTBOUND_PROVIDER_FAMILIES = ["emailbison", "smartlead", "instantly", "lemlist", "custom"] as const
export type GrowthOutboundProviderFamily = (typeof GROWTH_OUTBOUND_PROVIDER_FAMILIES)[number]

export const GROWTH_OUTBOUND_CONNECTION_STATUSES = ["active", "disabled", "error"] as const
export type GrowthOutboundConnectionStatus = (typeof GROWTH_OUTBOUND_CONNECTION_STATUSES)[number]

export const GROWTH_OUTBOUND_CAMPAIGN_TYPES = ["sequence", "broadcast", "unknown"] as const
export type GrowthOutboundCampaignType = (typeof GROWTH_OUTBOUND_CAMPAIGN_TYPES)[number]

export const GROWTH_OUTBOUND_CAMPAIGN_STATUSES = ["draft", "active", "paused", "archived"] as const
export type GrowthOutboundCampaignStatus = (typeof GROWTH_OUTBOUND_CAMPAIGN_STATUSES)[number]

export const GROWTH_OUTBOUND_CONTACT_STATUSES = ["pending", "active", "paused", "completed", "suppressed"] as const
export type GrowthOutboundContactStatus = (typeof GROWTH_OUTBOUND_CONTACT_STATUSES)[number]

export const GROWTH_OUTBOUND_MESSAGE_STATUSES = ["pending", "sent", "delivered", "failed", "bounced"] as const
export type GrowthOutboundMessageStatus = (typeof GROWTH_OUTBOUND_MESSAGE_STATUSES)[number]

export const CANONICAL_OUTBOUND_EVENT_TYPES = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "replied",
  "bounced",
  "unsubscribed",
  "failed",
  "spam_complaint",
] as const
export type CanonicalOutboundEventType = (typeof CANONICAL_OUTBOUND_EVENT_TYPES)[number]

export const GROWTH_OUTBOUND_REPLY_CLASSIFICATIONS = [
  "interested",
  "not_interested",
  "objection",
  "out_of_office",
  "referral",
  "unclassified",
] as const
export type GrowthOutboundReplyClassification = (typeof GROWTH_OUTBOUND_REPLY_CLASSIFICATIONS)[number]

export const GROWTH_OUTBOUND_REPLY_SENTIMENTS = ["positive", "neutral", "negative", "unknown"] as const
export type GrowthOutboundReplySentiment = (typeof GROWTH_OUTBOUND_REPLY_SENTIMENTS)[number]

export const GROWTH_SUPPRESSION_REASONS = ["unsubscribe", "bounce_hard", "spam_complaint", "manual", "legal"] as const
export type GrowthSuppressionReason = (typeof GROWTH_SUPPRESSION_REASONS)[number]

export const GROWTH_SUPPRESSION_SOURCES = ["provider_webhook", "manual", "fixture"] as const
export type GrowthSuppressionSource = (typeof GROWTH_SUPPRESSION_SOURCES)[number]

export const GROWTH_PROVIDER_WEBHOOK_STATUSES = ["received", "processed", "failed", "ignored"] as const
export type GrowthProviderWebhookStatus = (typeof GROWTH_PROVIDER_WEBHOOK_STATUSES)[number]

export const GROWTH_PROVIDER_WEBHOOK_RESOLUTION_STATUSES = ["resolved", "unresolved", "ignored"] as const
export type GrowthProviderWebhookResolutionStatus = (typeof GROWTH_PROVIDER_WEBHOOK_RESOLUTION_STATUSES)[number]

export const GROWTH_CONTACT_TEMPERATURES = ["cold", "warming", "engaged", "hot", "suppressed"] as const
export type GrowthContactTemperature = (typeof GROWTH_CONTACT_TEMPERATURES)[number]

export type GrowthEmailProviderConnection = {
  id: string
  provider: string
  providerFamily: GrowthOutboundProviderFamily
  label: string
  status: GrowthOutboundConnectionStatus
  apiBaseUrl: string | null
  webhookSecret: string | null
  config: Record<string, unknown>
  lastWebhookAt: string | null
  lastError: string | null
  monthlyCostEstimate: number | null
  seatCount: number | null
  notes: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthOutboundCampaign = {
  id: string
  connectionId: string
  provider: string
  providerCampaignId: string | null
  name: string
  campaignType: GrowthOutboundCampaignType
  status: GrowthOutboundCampaignStatus
  sourceChannel: string | null
  sourceCampaign: string | null
  sentCount: number
  replyCount: number
  positiveReplyCount: number
  callReadyCount: number
  unsubscribeCount: number
  bounceCount: number
  engagementScore: number
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthOutboundContact = {
  id: string
  connectionId: string
  campaignId: string | null
  leadId: string | null
  decisionMakerId: string | null
  email: string
  providerContactId: string | null
  enrollmentStatus: GrowthOutboundContactStatus
  firstContactedAt: string | null
  lastEventAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthOutboundMessage = {
  id: string
  connectionId: string
  contactId: string
  leadId: string
  campaignId: string | null
  providerMessageId: string | null
  sequenceStep: number | null
  subject: string | null
  bodyPreview: string | null
  sentAt: string | null
  deliveredAt: string | null
  status: GrowthOutboundMessageStatus
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthMessageEvent = {
  id: string
  connectionId: string
  leadId: string | null
  contactId: string | null
  messageId: string | null
  webhookId: string | null
  eventType: CanonicalOutboundEventType
  provider: string
  providerEventId: string
  occurredAt: string
  payload: Record<string, unknown>
  createdAt: string
}

export type GrowthOutboundReply = {
  id: string
  connectionId: string
  messageId: string | null
  contactId: string | null
  leadId: string
  messageEventId: string
  providerReplyId: string | null
  receivedAt: string
  bodyPreview: string | null
  classification: GrowthOutboundReplyClassification
  sentiment: GrowthOutboundReplySentiment
  confidence: number
  classificationLocked: boolean
  classificationLockedBy: string | null
  rawPayload: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthProviderWebhook = {
  id: string
  connectionId: string
  provider: string
  headers: Record<string, unknown>
  payload: Record<string, unknown>
  signatureValid: boolean | null
  status: GrowthProviderWebhookStatus
  resolutionStatus: GrowthProviderWebhookResolutionStatus
  resolvedLeadId: string | null
  errorMessage: string | null
  processedAt: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthSuppressionEntry = {
  id: string
  email: string
  reason: GrowthSuppressionReason
  source: GrowthSuppressionSource
  leadId: string | null
  contactId: string | null
  messageEventId: string | null
  notes: string | null
  suppressedAt: string
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export type OutboundFixtureEnvelope = {
  fixtureId?: string
  provider: string
  providerEventId: string
  eventType: CanonicalOutboundEventType
  occurredAt: string
  contact: {
    email: string
    providerContactId?: string
    firstName?: string
    lastName?: string
  }
  message?: {
    providerMessageId?: string
    subject?: string
    bodyPreview?: string
    sequenceStep?: number
    campaignName?: string
    bounceType?: "hard" | "soft"
  }
  reply?: {
    providerReplyId?: string
    bodyPreview?: string
    inReplyToProviderMessageId?: string
  }
  campaign?: {
    providerCampaignId?: string
    name?: string
  }
}

export type NormalizedOutboundEvent = {
  provider: string
  providerEventId: string
  eventType: CanonicalOutboundEventType
  occurredAt: string
  email: string
  providerContactId: string | null
  providerMessageId: string | null
  providerReplyId: string | null
  providerCampaignId: string | null
  campaignName: string | null
  subject: string | null
  bodyPreview: string | null
  sequenceStep: number | null
  inReplyToProviderMessageId: string | null
  bounceType: "hard" | "soft" | null
  raw: Record<string, unknown>
}

export type GrowthLeadEmailEventSummary = {
  sentCount14d: number
  openCount14d: number
  clickCount14d: number
  replyCount14d: number
  sentCount30d: number
  openCount30d: number
  interestedReply7d: boolean
  latestReplyClassification: GrowthOutboundReplyClassification | null
  isSuppressed: boolean
  lastSentAt: string | null
  lastReplyAt: string | null
}

export const EMPTY_GROWTH_LEAD_EMAIL_EVENT_SUMMARY: GrowthLeadEmailEventSummary = {
  sentCount14d: 0,
  openCount14d: 0,
  clickCount14d: 0,
  replyCount14d: 0,
  sentCount30d: 0,
  openCount30d: 0,
  interestedReply7d: false,
  latestReplyClassification: null,
  isSuppressed: false,
  lastSentAt: null,
  lastReplyAt: null,
}

export type ProcessOutboundEventResult = {
  ok: boolean
  duplicate?: boolean
  unresolved?: boolean
  leadId?: string
  messageEventId?: string
  error?: string
}
