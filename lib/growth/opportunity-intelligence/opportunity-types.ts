/** Client-safe Growth Engine opportunity intelligence types (Phase 2N). */

export const GROWTH_OPPORTUNITY_INTELLIGENCE_QA_MARKER = "growth-opportunity-intelligence-v1" as const

export const GROWTH_OPPORTUNITY_INTELLIGENCE_PRIVACY_NOTE =
  "Opportunity intelligence provides evidence-backed recommendations only. Human approval required — no autonomous CRM mutation, stage movement, or sequence pause."

export const GROWTH_OPPORTUNITY_SIGNAL_TYPES = [
  "meeting_interest",
  "pricing_interest",
  "timeline_interest",
  "decision_maker_detected",
  "committee_detected",
  "budget_signal",
  "technical_validation",
  "proposal_request",
  "competitive_signal",
  "urgency_signal",
] as const
export type GrowthOpportunitySignalType = (typeof GROWTH_OPPORTUNITY_SIGNAL_TYPES)[number]

export const GROWTH_OPPORTUNITY_RECOMMENDATION_TYPES = [
  "create_opportunity",
  "advance_stage",
  "pause_sequence",
  "stop_sequence",
  "follow_up_needed",
  "human_review_needed",
  "assign_owner",
  "committee_expansion",
] as const
export type GrowthOpportunityRecommendationType = (typeof GROWTH_OPPORTUNITY_RECOMMENDATION_TYPES)[number]

export const GROWTH_OPPORTUNITY_SIGNAL_CONFIDENCE_LEVELS = ["low", "medium", "high", "verified"] as const
export type GrowthOpportunitySignalConfidence = (typeof GROWTH_OPPORTUNITY_SIGNAL_CONFIDENCE_LEVELS)[number]

export const GROWTH_OPPORTUNITY_RECOMMENDATION_STATUSES = ["pending", "accepted", "dismissed", "expired"] as const
export type GrowthOpportunityRecommendationStatus = (typeof GROWTH_OPPORTUNITY_RECOMMENDATION_STATUSES)[number]

export type GrowthOpportunityEvidenceSnippet = {
  source: string
  snippet: string
  signalType?: GrowthOpportunitySignalType
  confidence?: GrowthOpportunitySignalConfidence
}

export type GrowthOpportunitySignal = {
  id: string
  leadId: string
  leadLabel: string
  inboxThreadId: string | null
  signalType: GrowthOpportunitySignalType
  confidence: GrowthOpportunitySignalConfidence
  evidenceSnippet: string
  source: string
  detectedAt: string
  metadata: Record<string, unknown>
}

export type GrowthOpportunityRecommendation = {
  id: string
  leadId: string
  leadLabel: string
  inboxThreadId: string | null
  recommendationType: GrowthOpportunityRecommendationType
  status: GrowthOpportunityRecommendationStatus
  title: string
  description: string
  evidence: GrowthOpportunityEvidenceSnippet[]
  signalIds: string[]
  requiresHumanApproval: true
  acceptedBy: string | null
  dismissedBy: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export type GrowthBuyingCommitteeSignal = {
  id: string
  leadId: string
  leadLabel: string
  inboxThreadId: string | null
  contactLabel: string
  roleHint: string | null
  signalStrength: GrowthOpportunitySignalConfidence
  evidenceSnippet: string
  source: string
  detectedAt: string
}

export type GrowthSequencePauseCandidate = {
  id: string
  leadId: string
  leadLabel: string
  sequenceEnrollmentId: string | null
  recommendationId: string | null
  reason: string
  signalType: GrowthOpportunitySignalType | null
  status: GrowthOpportunityRecommendationStatus
  evidenceSnippet: string
  detectedAt: string
}

export type GrowthCrmIntelligenceEvent = {
  id: string
  leadId: string | null
  recommendationId: string | null
  signalId: string | null
  eventType: string
  severity: "info" | "low" | "medium" | "high" | "critical"
  title: string
  description: string
  createdAt: string
}

export type GrowthOpportunityIntelligenceDashboard = {
  qa_marker: typeof GROWTH_OPPORTUNITY_INTELLIGENCE_QA_MARKER
  highIntentAccounts: Array<{ leadId: string; leadLabel: string; signalCount: number; topSignal: string }>
  opportunitySignals: GrowthOpportunitySignal[]
  committeeExpansion: GrowthBuyingCommitteeSignal[]
  recommendedActions: GrowthOpportunityRecommendation[]
  sequencePauseCandidates: GrowthSequencePauseCandidate[]
  buyingSignals: GrowthOpportunitySignal[]
  recentEvents: GrowthCrmIntelligenceEvent[]
}

export function maskOpportunityLeadLabel(leadId: string, companyName?: string | null): string {
  if (companyName?.trim()) return companyName.trim().slice(0, 80)
  return `Account ${leadId.slice(0, 8)}…`
}

export function signalTypeLabel(type: GrowthOpportunitySignalType): string {
  return type.replace(/_/g, " ")
}

export function recommendationTypeLabel(type: GrowthOpportunityRecommendationType): string {
  return type.replace(/_/g, " ")
}

export function sanitizeEvidenceSnippet(text: string, maxLength = 280): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
}
