export const GROWTH_LEAD_SOURCE_KINDS = [
  "manual",
  "import",
  "web",
  "referral",
  "partner",
  "other",
] as const

import type { GrowthContactTemperature } from "@/lib/growth/outbound/types"
import type { GrowthEngagementTier, GrowthEngagementTopSignal } from "@/lib/growth/engagement-types"
import type {
  GrowthOpportunityAccelerator,
  GrowthOpportunityAgeBucket,
  GrowthOpportunityBlocker,
  GrowthOpportunityBuyingSignalStrength,
  GrowthOpportunityReadinessTier,
  GrowthOpportunityReadinessTrend,
  GrowthOpportunityTopSignal,
} from "@/lib/growth/opportunity-types"
import type {
  GrowthRelationshipOwnerAttentionLevel,
  GrowthRelationshipTier,
  GrowthRelationshipTopSignal,
  GrowthRelationshipTrend,
} from "@/lib/growth/relationship-types"
import type { GrowthLeadCallDisposition, GrowthCallPriorityTier } from "@/lib/growth/call-types"
import type { GrowthDecisionMakerPresenceStatus } from "@/lib/growth/decision-maker-types"
import type { GrowthLeadAgingBucket } from "@/lib/growth/lead-aging"
import type { GrowthMomentumTier } from "@/lib/growth/momentum-types"
import type { GrowthNextBestAction } from "@/lib/growth/nba-types"
import type {
  GrowthForecastAttentionLevel,
  GrowthRevenueForecastTopSignal,
  GrowthRevenueProbabilityTier,
  GrowthRevenueTrajectory,
} from "@/lib/growth/revenue-forecast-types"
import type {
  GrowthExecutiveInterventionAgeBucket,
  GrowthExecutiveOperatingTopSignal,
  GrowthExecutivePriorityTier,
  GrowthIntelligenceConflict,
} from "@/lib/growth/executive-operating-types"
import type {
  GrowthCapacityConflict,
  GrowthCapacityRecoveryDirection,
  GrowthConstraintAgeBucket,
  GrowthOperationalCapacityTier,
  GrowthOperationalCapacityTopConstraint,
  GrowthOperationalConstraint,
} from "@/lib/growth/operational-capacity-types"
import type {
  GrowthSequenceFatigueRisk,
  GrowthSequenceRecommendedNextStep,
} from "@/lib/growth/sequence-types"
import type {
  GrowthConversationBuyingIntent,
  GrowthConversationCompetitorMention,
  GrowthConversationHealthTier,
  GrowthConversationMomentum,
  GrowthConversationObjectionProfile,
  GrowthConversationResponsePattern,
  GrowthConversationSentiment,
  GrowthConversationTopSignal,
  GrowthConversationTrend,
  GrowthConversationUrgencyLevel,
} from "@/lib/growth/conversation-types"

export type GrowthLeadSourceKind = (typeof GROWTH_LEAD_SOURCE_KINDS)[number]

export const GROWTH_LEAD_STATUSES = [
  "new",
  "researching",
  "enriched",
  "qualified",
  "in_outreach",
  "replied",
  "call_ready",
  "converted",
  "disqualified",
  "archived",
] as const

export type GrowthLeadStatus = (typeof GROWTH_LEAD_STATUSES)[number]

export const GROWTH_LEAD_RESEARCH_PRIORITIES = ["low", "normal", "high", "critical"] as const

export type GrowthLeadResearchPriority = (typeof GROWTH_LEAD_RESEARCH_PRIORITIES)[number]

export type GrowthLead = {
  id: string
  sourceKind: GrowthLeadSourceKind
  sourceDetail: string | null
  externalRef: string | null
  companyName: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  website: string | null
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  status: GrowthLeadStatus
  promotedOrganizationId: string | null
  promotedProspectId: string | null
  promotedAt: string | null
  score: number | null
  notes: string | null
  metadata: Record<string, unknown>
  latestResearchRunId: string | null
  lastResearchedAt: string | null
  researchPriority: GrowthLeadResearchPriority
  callDisposition: GrowthLeadCallDisposition | null
  callDispositionAt: string | null
  lastCallAt: string | null
  followUpAt: string | null
  callPriorityScore: number | null
  callPriorityTier: GrowthCallPriorityTier | null
  callPriorityComputedAt: string | null
  callPriorityOverride: number | null
  lastHumanTouchAt: string | null
  decisionMakerStatus: GrowthDecisionMakerPresenceStatus | null
  primaryDecisionMakerId: string | null
  nextBestAction: GrowthNextBestAction | null
  nextBestActionReason: string | null
  nextBestActionComputedAt: string | null
  estimatedAnnualRevenue: string | null
  estimatedEmployeeCount: string | null
  fleetSizeEstimate: string | null
  crmDetected: string | null
  fieldServiceStackDetected: string | null
  momentumScore: number | null
  momentumTier: GrowthMomentumTier | null
  momentumWhySummary: string | null
  momentumComputedAt: string | null
  workflowHealth: GrowthWorkflowHealthStatus | null
  workflowHealthReason: string | null
  workflowHealthComputedAt: string | null
  sourceChannel: string | null
  sourceCampaign: string | null
  sourceImportBatchId: string | null
  sourceVendor: string | null
  agingDays: number | null
  agingBucket: GrowthLeadAgingBucket | null
  firstHumanTouchAt: string | null
  timeToFirstTouchHours: number | null
  contactTemperature: GrowthContactTemperature | null
  callAttemptCount: number
  voicemailCount: number
  connectedCallCount: number
  engagementScore: number | null
  engagementTier: GrowthEngagementTier | null
  engagementLastActivityAt: string | null
  engagementSummary: string | null
  engagementTopSignals: GrowthEngagementTopSignal[]
  engagementDormancyExemptUntil: string | null
  engagementComputedAt: string | null
  relationshipStrengthScore: number | null
  relationshipStrengthTier: GrowthRelationshipTier | null
  relationshipLastMeaningfulTouchAt: string | null
  relationshipSummary: string | null
  relationshipTopSignals: GrowthRelationshipTopSignal[]
  relationshipTrend: GrowthRelationshipTrend | null
  relationshipPreviousScore: number | null
  relationshipOwnerAttentionLevel: GrowthRelationshipOwnerAttentionLevel
  relationshipRecoveryAttemptCount: number
  relationshipComputedAt: string | null
  opportunityReadinessScore: number | null
  opportunityReadinessTier: GrowthOpportunityReadinessTier | null
  opportunityReadinessSummary: string | null
  opportunityReadinessTopSignals: GrowthOpportunityTopSignal[]
  opportunityBlockers: GrowthOpportunityBlocker[]
  opportunityAccelerators: GrowthOpportunityAccelerator[]
  opportunityReadinessTrend: GrowthOpportunityReadinessTrend | null
  opportunityReadinessPreviousScore: number | null
  opportunityBuyingSignalStrength: GrowthOpportunityBuyingSignalStrength
  opportunityReadinessConfidence: number
  opportunityAgeBucket: GrowthOpportunityAgeBucket
  opportunityReadinessComputedAt: string | null
  revenueProbabilityScore: number | null
  revenueProbabilityTier: GrowthRevenueProbabilityTier | null
  revenueProbabilitySummary: string | null
  revenueProbabilityTopSignals: GrowthRevenueForecastTopSignal[]
  revenueProbabilityConfidence: number
  revenueProbabilityPreviousScore: number | null
  revenueTrajectory: GrowthRevenueTrajectory
  revenueProbabilityVolatility: number
  forecastContributionWeight: number
  forecastAttentionLevel: GrowthForecastAttentionLevel
  forecastAttentionLastChangedAt: string | null
  revenueForecastComputedAt: string | null
  executivePriorityScore: number | null
  executivePriorityTier: GrowthExecutivePriorityTier | null
  executivePrioritySummary: string | null
  executivePriorityTopSignals: GrowthExecutiveOperatingTopSignal[]
  executivePriorityVolatility: number
  executivePriorityPreviousScore: number | null
  intelligenceConflicts: GrowthIntelligenceConflict[]
  intelligenceConflictSeverityScore: number
  executiveRecommendation: string | null
  executiveOwner: string | null
  executiveInterventionOpenedAt: string | null
  executiveInterventionAgeBucket: GrowthExecutiveInterventionAgeBucket
  executiveOperatingComputedAt: string | null
  operationalCapacityScore: number | null
  operationalCapacityTier: GrowthOperationalCapacityTier | null
  operationalCapacitySummary: string | null
  operationalCapacityTopConstraints: GrowthOperationalCapacityTopConstraint[]
  capacityPressureLevel: number
  capacityPressureVolatility: number
  protectedPipelineCoverage: number
  operationalConstraints: GrowthOperationalConstraint[]
  capacityConflicts: GrowthCapacityConflict[]
  capacityProtectionRecommendation: string | null
  constraintOpenedAt: string | null
  constraintAgeBucket: GrowthConstraintAgeBucket
  capacityRecoveryDirection: GrowthCapacityRecoveryDirection
  operationalCapacityPreviousScore: number | null
  operationalCapacityComputedAt: string | null
  conversationHealthScore: number | null
  conversationHealthTier: GrowthConversationHealthTier | null
  conversationSummary: string | null
  conversationTopSignals: GrowthConversationTopSignal[]
  conversationSentiment: GrowthConversationSentiment | null
  conversationUrgencyLevel: GrowthConversationUrgencyLevel | null
  conversationBuyingIntent: GrowthConversationBuyingIntent | null
  conversationObjectionProfile: GrowthConversationObjectionProfile
  conversationCompetitorMentions: GrowthConversationCompetitorMention[]
  conversationCompetitorPressure: number | null
  conversationLastMeaningfulConversationAt: string | null
  conversationPreviousScore: number | null
  conversationTrend: GrowthConversationTrend | null
  conversationConfidence: number | null
  conversationMomentum: GrowthConversationMomentum | null
  conversationResponsePattern: GrowthConversationResponsePattern | null
  conversationComputedAt: string | null
  recommendedSequencePatternId: string | null
  recommendedSequenceReason: string | null
  recommendedSequenceConfidence: number | null
  recommendedSequenceNextStep: GrowthSequenceRecommendedNextStep | Record<string, never>
  sequenceFatigueRisk: GrowthSequenceFatigueRisk | null
  recommendedSequenceComputedAt: string | null
  activeSequenceEnrollmentId: string | null
  archivedAt: string | null
  archivedBy: string | null
  archiveReason: string | null
  createdBy: string | null
  assignedTo: string | null
  createdAt: string
  updatedAt: string
}

export type CreateGrowthLeadInput = {
  sourceKind?: GrowthLeadSourceKind
  sourceDetail?: string | null
  externalRef?: string | null
  companyName: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  website?: string | null
  addressLine1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  status?: GrowthLeadStatus
  score?: number | null
  notes?: string | null
  metadata?: Record<string, unknown>
  researchPriority?: GrowthLeadResearchPriority
  callPriorityOverride?: number | null
  decisionMakerStatus?: GrowthDecisionMakerPresenceStatus | null
  primaryDecisionMakerId?: string | null
  estimatedAnnualRevenue?: string | null
  estimatedEmployeeCount?: string | null
  fleetSizeEstimate?: string | null
  crmDetected?: string | null
  fieldServiceStackDetected?: string | null
  sourceChannel?: string | null
  sourceCampaign?: string | null
  sourceImportBatchId?: string | null
  sourceVendor?: string | null
  assignedTo?: string | null
  createdBy?: string | null
}

export type UpdateGrowthLeadInput = {
  sourceKind?: GrowthLeadSourceKind
  sourceDetail?: string | null
  externalRef?: string | null
  companyName?: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  website?: string | null
  addressLine1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  status?: GrowthLeadStatus
  score?: number | null
  notes?: string | null
  metadata?: Record<string, unknown>
  researchPriority?: GrowthLeadResearchPriority
  callPriorityOverride?: number | null
  decisionMakerStatus?: GrowthDecisionMakerPresenceStatus | null
  primaryDecisionMakerId?: string | null
  estimatedAnnualRevenue?: string | null
  estimatedEmployeeCount?: string | null
  fleetSizeEstimate?: string | null
  crmDetected?: string | null
  fieldServiceStackDetected?: string | null
  sourceChannel?: string | null
  sourceCampaign?: string | null
  sourceImportBatchId?: string | null
  sourceVendor?: string | null
  assignedTo?: string | null
}

export type ListGrowthLeadsInput = {
  status?: GrowthLeadStatus
  includeArchived?: boolean
  limit?: number
  offset?: number
}
