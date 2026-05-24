/** Client-safe Growth Engine conversation intelligence types. */

export const GROWTH_CONVERSATION_HEALTH_TIERS = ["cold", "neutral", "positive", "strong", "critical"] as const
export type GrowthConversationHealthTier = (typeof GROWTH_CONVERSATION_HEALTH_TIERS)[number]

export const GROWTH_CONVERSATION_SENTIMENTS = ["positive", "neutral", "negative", "mixed"] as const
export type GrowthConversationSentiment = (typeof GROWTH_CONVERSATION_SENTIMENTS)[number]

export const GROWTH_CONVERSATION_URGENCY_LEVELS = ["none", "low", "medium", "high", "critical"] as const
export type GrowthConversationUrgencyLevel = (typeof GROWTH_CONVERSATION_URGENCY_LEVELS)[number]

export const GROWTH_CONVERSATION_BUYING_INTENTS = ["none", "weak", "moderate", "strong", "urgent"] as const
export type GrowthConversationBuyingIntent = (typeof GROWTH_CONVERSATION_BUYING_INTENTS)[number]

export const GROWTH_CONVERSATION_TRENDS = ["improving", "stable", "cooling", "at_risk"] as const
export type GrowthConversationTrend = (typeof GROWTH_CONVERSATION_TRENDS)[number]

export const GROWTH_CONVERSATION_MOMENTUM = [
  "accelerating",
  "stable",
  "slowing",
  "recovering",
  "stalling",
] as const
export type GrowthConversationMomentum = (typeof GROWTH_CONVERSATION_MOMENTUM)[number]

export const GROWTH_CONVERSATION_RESPONSE_PATTERNS = [
  "very_fast",
  "fast",
  "normal",
  "slow",
  "unresponsive",
] as const
export type GrowthConversationResponsePattern = (typeof GROWTH_CONVERSATION_RESPONSE_PATTERNS)[number]

export const GROWTH_CONVERSATION_OBJECTION_KEYS = [
  "budget",
  "timing",
  "already_using_solution",
  "authority",
  "implementation",
  "priority",
  "feature_gap",
  "other",
] as const
export type GrowthConversationObjectionKey = (typeof GROWTH_CONVERSATION_OBJECTION_KEYS)[number]

export type GrowthConversationTopSignal = {
  kind: string
  label: string
  points: number
  occurredAt: string
  source: "email" | "call" | "manual" | "ai" | "notes"
}

export type GrowthConversationObjectionCluster = {
  key: GrowthConversationObjectionKey
  count: number
  severityWeight: number
  lastAt: string | null
}

export type GrowthConversationObjectionProfile = {
  clusters: GrowthConversationObjectionCluster[]
  totalSeverityScore: number
}

export type GrowthConversationCompetitorMention = {
  name: string
  count: number
  lastMentionedAt: string
  trend: "up" | "stable" | "down"
}

export type GrowthConversationSignal = {
  kind: string
  label: string
  points: number
  occurredAt: string
  source: GrowthConversationTopSignal["source"]
  text?: string | null
}

export type GrowthLeadConversationInput = {
  leadId: string
  isSuppressed: boolean
  notInterested: boolean
  notes: string | null
  signals: GrowthConversationSignal[]
  replyLatenciesMs: number[]
  previousScore: number | null
  previousTrend: GrowthConversationTrend | null
  relationshipTrend: string | null
  now?: Date
}

export type GrowthLeadConversationResult = {
  score: number
  tier: GrowthConversationHealthTier
  summary: string
  topSignals: GrowthConversationTopSignal[]
  sentiment: GrowthConversationSentiment
  urgencyLevel: GrowthConversationUrgencyLevel
  buyingIntent: GrowthConversationBuyingIntent
  objectionProfile: GrowthConversationObjectionProfile
  competitorMentions: GrowthConversationCompetitorMention[]
  competitorPressure: number
  lastMeaningfulConversationAt: string | null
  trend: GrowthConversationTrend
  confidence: number
  momentum: GrowthConversationMomentum
  responsePattern: GrowthConversationResponsePattern
}

export const GROWTH_CONVERSATION_OBJECTION_SEVERITY: Record<GrowthConversationObjectionKey, number> = {
  budget: 12,
  timing: 6,
  already_using_solution: 18,
  authority: 15,
  implementation: 10,
  priority: 5,
  feature_gap: 14,
  other: 4,
}
