/**
 * GE-AIOS-DECISION-ENGINE-1A — Canonical decision input bundle (client-safe).
 * Consumes existing subsystem outputs only — never re-derives them.
 */

import type { AdaptiveStrategyChangeDetection } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import type { GrowthInstitutionalSalesIntelligence } from "@/lib/growth/aios/growth/growth-institutional-learning-1a-types"
import type { GrowthOutreachRelationshipAssessment } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"
import type { RevenueStrategyRecommendation } from "@/lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import type { CanonicalHumanMemoryBundle } from "@/lib/growth/lead-memory/canonical-human-memory-types"

export type GrowthCanonicalDecisionOperatorConstraints = {
  archived?: boolean
  paused?: boolean
  disqualified?: boolean
  unsubscribed?: boolean
  operatorPausedOutreach?: boolean
}

export type GrowthCanonicalDecisionReplyState = {
  classification: string | null
  intent: string | null
  isMaterial: boolean
  isOutOfOffice: boolean
  isUnknown: boolean
  receivedAt: string | null
}

export type GrowthCanonicalDecisionPostCallState = {
  commitments: string[]
  objections: string[]
  buyingSignals: string[]
  businessConclusions: string[]
  operatorOutcome?: string | null
  meetingBooked?: boolean
  timelineDetected?: boolean
  agreedWaitUntil?: string | null
}

export type GrowthCanonicalDecisionMeetingState = {
  hasUpcomingMeeting: boolean
  meetingAt: string | null
  meetingObjective: string | null
  stakeholderRole: string | null
  stakeholderContactId: string | null
  postMeetingProposalRequested?: boolean
}

export type GrowthCanonicalDecisionPackageState = {
  packageId: string | null
  status: "none" | "draft" | "pending_approval" | "approved" | "sent" | "blocked"
  purpose: string | null
  promisedInformationPending?: boolean
  promisedInformationSent?: boolean
}

export type GrowthCanonicalDecisionApprovalState = {
  pendingOperatorReview: boolean
  pendingPackageApproval: boolean
  label: string | null
}

export type GrowthCanonicalDecisionTransportState = {
  blocked: boolean
  reason: string | null
}

export type GrowthCanonicalDecisionSequenceState = {
  enrolled: boolean
  nextScheduledAt: string | null
  nextStepLabel: string | null
}

export type GrowthCanonicalDecisionBuyingCommitteeState = {
  championIdentified: boolean
  recommendedStakeholderRole: string | null
  recommendedStakeholderLabel: string | null
  multiThreadRecommended: boolean
  summary: string | null
}

export type GrowthCanonicalDecisionCommercialReadiness = {
  pricingInputsComplete: boolean
  proposalInputsComplete: boolean
  discoveryGaps: string[]
}

export type GrowthCanonicalDecisionInput = {
  organizationId: string
  leadId: string
  generatedAt: string
  companyName?: string | null
  contactName?: string | null

  memoryBundle: CanonicalHumanMemoryBundle | null
  relationshipAssessment: GrowthOutreachRelationshipAssessment | null
  revenueStrategy: RevenueStrategyRecommendation | null
  adaptiveEvolution: AdaptiveStrategyChangeDetection | null
  institutionalAdvice: GrowthInstitutionalSalesIntelligence | null
  committee: GrowthCanonicalDecisionBuyingCommitteeState | null
  replyState: GrowthCanonicalDecisionReplyState | null
  postCall: GrowthCanonicalDecisionPostCallState | null
  meeting: GrowthCanonicalDecisionMeetingState | null
  packageState: GrowthCanonicalDecisionPackageState | null
  draftFactoryStatus: string | null
  approvalState: GrowthCanonicalDecisionApprovalState | null
  sequenceState: GrowthCanonicalDecisionSequenceState | null
  transportState: GrowthCanonicalDecisionTransportState | null
  operatorConstraints: GrowthCanonicalDecisionOperatorConstraints | null
  commercialReadiness: GrowthCanonicalDecisionCommercialReadiness | null

  /** Stable versions for fingerprinting — supplied by callers, not invented here. */
  sourceVersions?: {
    memoryVersion?: string | null
    relationshipVersion?: string | null
    revenueVersion?: string | null
    packageVersion?: string | null
    meetingVersion?: string | null
    approvalVersion?: string | null
    materialEventId?: string | null
  }
}
