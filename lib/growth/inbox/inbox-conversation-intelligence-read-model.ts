/** Client-safe conversation intelligence read model for Inbox convergence (Phase 7N). */

import { growthLeadConversationActionRequired } from "@/lib/growth/growth-lead-drawer-badges"
import {
  growthWorkspaceConversationsHref,
  growthWorkspaceInboxHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_INBOX_CONVERSATION_INTELLIGENCE_READ_MODEL_QA_MARKER =
  "growth-inbox-conversation-intelligence-read-model-v1" as const

export type GrowthInboxConversationIntelligencePreview = {
  qaMarker: typeof GROWTH_INBOX_CONVERSATION_INTELLIGENCE_READ_MODEL_QA_MARKER
  leadId: string
  healthScore: number | null
  healthTier: GrowthLead["conversationHealthTier"]
  sentiment: GrowthLead["conversationSentiment"]
  momentum: GrowthLead["conversationMomentum"]
  buyingIntent: GrowthLead["conversationBuyingIntent"]
  summarySnippet: string | null
  recommendationPreview: string | null
  actionRequired: boolean
  lastActivityAt: string | null
  conversationsHref: string
  timelineHref: string
  inboxHref: string
}

function truncateSnippet(value: string, maxLength = 120): string {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 3)}...`
}

export function summarizeConversationSummarySnippet(lead: Pick<GrowthLead, "conversationSummary">): string | null {
  if (!lead.conversationSummary?.trim()) return null
  return truncateSnippet(lead.conversationSummary)
}

export function summarizeConversationRecommendationPreview(
  lead: Pick<GrowthLead, "conversationTopSignals" | "conversationBuyingIntent" | "conversationUrgencyLevel">,
): string | null {
  const topSignal = lead.conversationTopSignals?.[0]
  if (topSignal?.label) return topSignal.label
  if (lead.conversationBuyingIntent && lead.conversationBuyingIntent !== "none") {
    return `Buying intent: ${lead.conversationBuyingIntent.replace(/_/g, " ")}`
  }
  if (lead.conversationUrgencyLevel && lead.conversationUrgencyLevel !== "none") {
    return `Urgency: ${lead.conversationUrgencyLevel}`
  }
  return null
}

export function adaptGrowthLeadToInboxConversationPreview(
  lead: GrowthLead,
  input?: { threadId?: string | null },
): GrowthInboxConversationIntelligencePreview {
  return {
    qaMarker: GROWTH_INBOX_CONVERSATION_INTELLIGENCE_READ_MODEL_QA_MARKER,
    leadId: lead.id,
    healthScore: lead.conversationHealthScore,
    healthTier: lead.conversationHealthTier,
    sentiment: lead.conversationSentiment,
    momentum: lead.conversationMomentum,
    buyingIntent: lead.conversationBuyingIntent,
    summarySnippet: summarizeConversationSummarySnippet(lead),
    recommendationPreview: summarizeConversationRecommendationPreview(lead),
    actionRequired: growthLeadConversationActionRequired(lead),
    lastActivityAt: lead.conversationLastMeaningfulConversationAt,
    conversationsHref: growthWorkspaceConversationsHref({ leadId: lead.id, threadId: input?.threadId }),
    timelineHref: growthWorkspaceConversationsHref({ leadId: lead.id }),
    inboxHref: growthWorkspaceInboxHref({ leadId: lead.id, threadId: input?.threadId }),
  }
}

export function hasInboxConversationIntelligencePreview(
  lead: Pick<
    GrowthLead,
    | "conversationHealthScore"
    | "conversationSummary"
    | "conversationSentiment"
    | "conversationTopSignals"
    | "conversationBuyingIntent"
  >,
): boolean {
  return (
    lead.conversationHealthScore != null ||
    Boolean(lead.conversationSummary?.trim()) ||
    lead.conversationSentiment != null ||
    (lead.conversationTopSignals?.length ?? 0) > 0 ||
    (lead.conversationBuyingIntent != null && lead.conversationBuyingIntent !== "none")
  )
}
