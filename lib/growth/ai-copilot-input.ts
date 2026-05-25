import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthLeadDecisionMakers } from "@/lib/growth/decision-maker-repository"
import { resolveGrowthAiCopilotFrameworkKeys } from "@/lib/growth/ai-copilot-frameworks"
import type { GrowthAiCopilotInputSnapshot } from "@/lib/growth/ai-copilot-types"
import { listGrowthOutboundMessagesForLead } from "@/lib/growth/outbound/message-repository"
import { listGrowthOutboundRepliesForLead } from "@/lib/growth/outbound/reply-repository"
import { fetchLatestUsableGrowthLeadResearchRun } from "@/lib/growth/research-repository"
import { fetchLatestCompletedProspectResearchRun } from "@/lib/growth/research/research-repository"
import type { GrowthLead } from "@/lib/growth/types"

function truncate(value: string | null | undefined, max = 240): string {
  const trimmed = value?.trim() ?? ""
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

export async function buildGrowthAiCopilotInput(
  admin: SupabaseClient,
  lead: GrowthLead,
  options?: { sourceReplyId?: string | null },
): Promise<GrowthAiCopilotInputSnapshot> {
  const [decisionMakers, messages, replies, researchRun, prospectRun] = await Promise.all([
    listGrowthLeadDecisionMakers(admin, lead.id),
    listGrowthOutboundMessagesForLead(admin, lead.id),
    listGrowthOutboundRepliesForLead(admin, lead.id),
    lead.latestResearchRunId
      ? fetchLatestUsableGrowthLeadResearchRun(admin, lead.id)
      : Promise.resolve(null),
    lead.latestProspectResearchRunId
      ? fetchLatestCompletedProspectResearchRun(admin, lead.id)
      : Promise.resolve(null),
  ])

  const sourceReply = options?.sourceReplyId
    ? replies.find((reply) => reply.id === options.sourceReplyId)
    : replies[0]

  const recentOutbound = [
    ...messages.slice(0, 3).map((message) => ({
      direction: "outbound" as const,
      preview: truncate(message.subject ?? message.bodyPreview ?? "Outbound message"),
      classification: null,
      occurredAt: message.sentAt ?? message.createdAt,
    })),
    ...replies.slice(0, 2).map((reply) => ({
      direction: "inbound" as const,
      preview: truncate(reply.bodyPreview),
      classification: reply.classification,
      occurredAt: reply.receivedAt ?? reply.createdAt,
    })),
  ]
    .sort((a, b) => Date.parse(b.occurredAt ?? "") - Date.parse(a.occurredAt ?? ""))
    .slice(0, 5)

  return {
    companyName: lead.companyName,
    contactName: lead.contactName,
    fitScore: lead.score,
    engagementTier: lead.engagementTier,
    engagementSummary: truncate(lead.engagementSummary, 160),
    relationshipTier: lead.relationshipStrengthTier,
    relationshipTrend: lead.relationshipTrend,
    opportunityTier: lead.opportunityReadinessTier,
    opportunityBlockers: lead.opportunityBlockers.map((entry) => entry.label),
    opportunityAccelerators: lead.opportunityAccelerators.map((entry) => entry.label),
    revenueTier: lead.revenueProbabilityTier,
    revenueTrajectory: lead.revenueTrajectory,
    executiveTier: lead.executivePriorityTier,
    executiveRecommendation: truncate(lead.executiveRecommendation, 160),
    capacityTier: lead.operationalCapacityTier,
    capacityProtection: truncate(lead.capacityProtectionRecommendation, 160),
    researchSummary: truncate(prospectRun?.researchSummary ?? researchRun?.result?.companySummary ?? lead.notes, 200),
    researchNextAction: truncate(
      prospectRun?.recommendedNextAction ?? researchRun?.result?.recommendedNextAction ?? null,
      120,
    ),
    decisionMakers: decisionMakers.slice(0, 4).map((dm) => ({
      name: dm.fullName,
      title: dm.title,
      status: dm.status,
    })),
    nextBestAction: lead.nextBestAction,
    nextBestActionReason: truncate(lead.nextBestActionReason, 160),
    recentOutbound,
    replyPreview: truncate(sourceReply?.bodyPreview, 1200) || null,
    frameworks: resolveGrowthAiCopilotFrameworkKeys(lead),
  }
}
