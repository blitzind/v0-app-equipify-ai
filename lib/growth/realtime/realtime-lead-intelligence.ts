import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthLeadRealtimeIntelligenceInput } from "@/lib/growth/realtime/realtime-call-types"
import { isCallWorkspaceTranscriptAnchorLead as isTranscriptAnchorMetadata } from "@/lib/growth/native-dialer/call-workspace-coaching-types"

export function emptyGrowthLeadRealtimeIntelligenceInput(): GrowthLeadRealtimeIntelligenceInput {
  return {}
}

function isCallWorkspaceTranscriptAnchorLead(lead: Pick<GrowthLead, "metadata">): boolean {
  const metadata =
    lead.metadata && typeof lead.metadata === "object"
      ? (lead.metadata as Record<string, unknown>)
      : null
  return isTranscriptAnchorMetadata(metadata)
}

export function toGrowthLeadRealtimeIntelligenceInput(lead: GrowthLead): GrowthLeadRealtimeIntelligenceInput {
  if (isCallWorkspaceTranscriptAnchorLead(lead)) {
    return emptyGrowthLeadRealtimeIntelligenceInput()
  }
  return {
    decisionMakerStatus: lead.decisionMakerStatus,
    conversationUrgencyLevel: lead.conversationUrgencyLevel,
    conversationBuyingIntent: lead.conversationBuyingIntent,
    conversationSentiment: lead.conversationSentiment,
    conversationMomentum: lead.conversationMomentum,
    relationshipTrend: lead.relationshipTrend,
    opportunityReadinessTier: lead.opportunityReadinessTier,
    revenueTrajectory: lead.revenueTrajectory,
    revenueProbabilityTier: lead.revenueProbabilityTier,
    executivePriorityTier: lead.executivePriorityTier,
    recommendedSequenceNextStep: lead.recommendedSequenceNextStep,
    conversationCompetitorPressure: lead.conversationCompetitorPressure,
  }
}
