import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthLeadRealtimeIntelligenceInput } from "@/lib/growth/realtime/realtime-call-types"

export function toGrowthLeadRealtimeIntelligenceInput(lead: GrowthLead): GrowthLeadRealtimeIntelligenceInput {
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
