/** Client-safe Growth Engine lead memory types (Phase 2T). */

export const GROWTH_LEAD_MEMORY_ENGINE_QA_MARKER = "growth-lead-memory-engine-v1" as const

export const GROWTH_LEAD_MEMORY_PRIVACY_NOTE =
  "Lead memory is evidence-backed relationship context only. No autonomous CRM mutation, no autonomous outreach, no hidden memory from unrelated data, no provider payloads or secrets."

export const GROWTH_LEAD_MEMORY_HUMAN_KINDS = [
  "business_fact",
  "personal_context",
  "communication_style",
  "sales_conclusion",
  "action_commitment",
] as const
export type GrowthLeadMemoryHumanKind = (typeof GROWTH_LEAD_MEMORY_HUMAN_KINDS)[number]

export const GROWTH_LEAD_MEMORY_CATEGORIES = [
  "communication_preference",
  "buying_signal",
  "objection",
  "timeline_signal",
  "budget_signal",
  "meeting_signal",
  "engagement_pattern",
  "industry_interest",
  "committee_member",
  "decision_authority",
  "risk_signal",
  "competitor_signal",
] as const
export type GrowthLeadMemoryCategory = (typeof GROWTH_LEAD_MEMORY_CATEGORIES)[number]

export const GROWTH_RELATIONSHIP_STAGES = [
  "unknown",
  "aware",
  "engaged",
  "evaluating",
  "opportunity",
  "customer",
  "inactive",
] as const
export type GrowthRelationshipStage = (typeof GROWTH_RELATIONSHIP_STAGES)[number]

export const GROWTH_MEMORY_CONFIDENCE_LEVELS = ["low", "medium", "high", "verified"] as const
export type GrowthMemoryConfidence = (typeof GROWTH_MEMORY_CONFIDENCE_LEVELS)[number]

export const GROWTH_LEAD_PREFERENCE_TYPES = [
  "communication_preference",
  "buying_preference",
  "timing_preference",
  "channel_preference",
] as const
export type GrowthLeadPreferenceType = (typeof GROWTH_LEAD_PREFERENCE_TYPES)[number]

export const GROWTH_COMMITTEE_INFLUENCE_LEVELS = [
  "unknown",
  "low",
  "medium",
  "high",
  "decision_maker",
] as const
export type GrowthCommitteeInfluenceLevel = (typeof GROWTH_COMMITTEE_INFLUENCE_LEVELS)[number]

export type GrowthLeadMemoryEvidence = {
  source: string
  snippet: string
  category?: GrowthLeadMemoryCategory
  confidence?: GrowthMemoryConfidence
}

export type GrowthLeadMemoryEvent = {
  id: string
  leadLabel: string
  memoryCategory: GrowthLeadMemoryCategory
  confidence: GrowthMemoryConfidence
  title: string
  evidenceSnippet: string
  sourceSystem: string
  recordedAt: string
  metadata?: Record<string, unknown>
}

export type GrowthLeadObjectionMemory = {
  id: string
  leadLabel: string
  objectionType: string
  objectionLabel: string
  severity: "low" | "medium" | "high" | "critical"
  confidence: GrowthMemoryConfidence
  evidenceSnippet: string
  occurrenceCount: number
  resolved: boolean
  lastSeenAt: string
}

export type GrowthLeadPreferenceMemory = {
  id: string
  leadLabel: string
  preferenceType: GrowthLeadPreferenceType
  preferenceKey: string
  preferenceValue: string
  confidence: GrowthMemoryConfidence
  evidenceSnippet: string
}

export type GrowthCommitteeRelationshipContext = {
  id: string
  leadLabel: string
  memberLabel: string
  roleHint: string
  influenceLevel: GrowthCommitteeInfluenceLevel
  confidence: GrowthMemoryConfidence
  evidenceSnippet: string
}

export type GrowthLeadMemoryProfile = {
  id: string
  leadId: string
  leadLabel: string
  relationshipStage: GrowthRelationshipStage
  memoryCoverageScore: number
  eventCount: number
  objectionCount: number
  preferenceCount: number
  committeeMemberCount: number
  buyingSignalCount: number
  highestConfidence: GrowthMemoryConfidence
  summary: string
  lastRebuiltAt: string | null
  updatedAt: string
}

export type GrowthRelationshipContext = {
  id: string
  leadLabel: string
  accountLabel: string
  relationshipStage: GrowthRelationshipStage
  progressionScore: number
  engagementTrend: "improving" | "stable" | "cooling" | "declining"
  topSignals: string[]
  riskFlags: string[]
}

export type GrowthRelationshipSummarySnapshot = {
  id: string
  leadLabel: string
  relationshipStage: GrowthRelationshipStage
  summary: string
  memoryCoverageScore: number
  recordedAt: string
}

export type GrowthLeadMemoryDashboard = {
  qa_marker: typeof GROWTH_LEAD_MEMORY_ENGINE_QA_MARKER
  memoryCoverage: number
  relationshipStages: Record<GrowthRelationshipStage, number>
  committeeCoverage: number
  buyingSignals: number
  topObjections: GrowthLeadObjectionMemory[]
  communicationPreferences: GrowthLeadPreferenceMemory[]
  profiles: GrowthLeadMemoryProfile[]
  recentEvents: GrowthLeadMemoryEvent[]
}

export type GrowthLeadMemoryProfileView = {
  profile: GrowthLeadMemoryProfile | null
  relationshipContext: GrowthRelationshipContext | null
  events: GrowthLeadMemoryEvent[]
  objections: GrowthLeadObjectionMemory[]
  preferences: GrowthLeadPreferenceMemory[]
  committeeMembers: GrowthCommitteeRelationshipContext[]
  summarySnapshots: GrowthRelationshipSummarySnapshot[]
}

/** Projected memory context for Growth Engine decision surfaces (Sprint 3). */
export type GrowthLeadMemoryInfluenceContext = {
  available: boolean
  memoryCoverageScore: number | null
  relationshipStage: string | null
  relationshipSummary: string | null
  engagementTrend: string | null
  progressionScore: number | null
  topObjections: string[]
  topPreferences: string[]
  priorInteractionSummaries: string[]
  commitmentSummaries: string[]
  riskFlags: string[]
  avoidRepeating: string[]
  committeeContext: string[]
  unresolvedObjectionCount: number
  unresolvedHighSeverityObjectionCount: number
}

export const GROWTH_LEAD_MEMORY_UTILIZATION_QA_MARKER = "growth-lead-memory-utilization-v1" as const

export function sanitizeMemoryEvidenceSnippet(text: string, maxLength = 280): string {
  const cleaned = text
    .replace(/api[_-]?key[^\s]*/gi, "[redacted]")
    .replace(/password[^\s]*/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
    .replace(/\s+/g, " ")
    .trim()
  if (!cleaned) return "Evidence recorded."
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned
}

export function maskLeadMemoryLabel(leadId: string, companyName?: string | null): string {
  if (companyName?.trim()) return companyName.trim().slice(0, 80)
  return `Account ${leadId.slice(0, 8)}…`
}

export function memoryCategoryLabel(category: GrowthLeadMemoryCategory): string {
  return category.replace(/_/g, " ")
}

export function relationshipStageLabel(stage: GrowthRelationshipStage): string {
  switch (stage) {
    case "unknown":
      return "Unknown"
    case "aware":
      return "Aware"
    case "engaged":
      return "Engaged"
    case "evaluating":
      return "Evaluating"
    case "opportunity":
      return "Opportunity"
    case "customer":
      return "Customer"
    case "inactive":
      return "Inactive"
    default:
      return stage
  }
}

export function confidenceRank(confidence: GrowthMemoryConfidence): number {
  switch (confidence) {
    case "low":
      return 1
    case "medium":
      return 2
    case "high":
      return 3
    case "verified":
      return 4
    default:
      return 0
  }
}

export function highestConfidenceLevel(levels: GrowthMemoryConfidence[]): GrowthMemoryConfidence {
  if (levels.length === 0) return "low"
  return levels.reduce((best, current) => (confidenceRank(current) > confidenceRank(best) ? current : best))
}
