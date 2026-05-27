/** Client-safe Growth Engine AI personalization types (Phase 2V). */

export const GROWTH_AI_PERSONALIZATION_QA_MARKER = "growth-ai-personalization-v1" as const

export const GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE =
  "AI personalization is evidence-backed and human-gated only. No autonomous sends, no autonomous approval, no hallucinated company facts, no unsupported claims, no hidden AI generation, no compliance bypass."

export const GROWTH_PERSONALIZATION_GENERATION_STATUSES = [
  "draft",
  "approved",
  "rejected",
  "sent",
  "archived",
  "blocked",
] as const
export type GrowthPersonalizationGenerationStatus = (typeof GROWTH_PERSONALIZATION_GENERATION_STATUSES)[number]

export const GROWTH_PERSONALIZATION_SOURCES = [
  "relationship_memory",
  "opportunity_intelligence",
  "booking_intelligence",
  "market_graph",
  "territory_intelligence",
  "website_intelligence",
  "engagement_history",
  "committee_context",
  "buying_signals",
  "company_signals",
] as const
export type GrowthPersonalizationSource = (typeof GROWTH_PERSONALIZATION_SOURCES)[number]

export const GROWTH_PERSONALIZATION_RISK_LEVELS = ["low", "medium", "high", "critical"] as const
export type GrowthPersonalizationRiskLevel = (typeof GROWTH_PERSONALIZATION_RISK_LEVELS)[number]

export const GROWTH_PERSONALIZATION_FEEDBACK_TYPES = [
  "approved",
  "edited",
  "rejected",
  "performed_well",
  "performed_poorly",
] as const
export type GrowthPersonalizationFeedbackType = (typeof GROWTH_PERSONALIZATION_FEEDBACK_TYPES)[number]

export type GrowthPersonalizationEvidence = {
  id: string
  sourceType: GrowthPersonalizationSource
  claimKey: string
  evidenceSnippet: string
  confidence: "low" | "medium" | "high" | "verified"
}

export type GrowthPersonalizationRiskEvent = {
  id: string
  riskType: string
  severity: GrowthPersonalizationRiskLevel
  title: string
  description: string
  recordedAt: string
}

export type GrowthPersonalizationFeedback = {
  id: string
  feedbackType: GrowthPersonalizationFeedbackType
  notes: string
  actorEmail: string
  recordedAt: string
}

export type GrowthPersonalizationGeneration = {
  id: string
  leadId: string
  leadLabel: string
  status: GrowthPersonalizationGenerationStatus
  subject: string
  body: string
  personalizationScore: number
  evidenceCoverageScore: number
  riskLevel: GrowthPersonalizationRiskLevel
  blockedReason: string
  sourceSummary: GrowthPersonalizationSource[]
  requiresHumanReview: boolean
  approvedAt: string | null
  rejectedAt: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthPersonalizationGenerationView = GrowthPersonalizationGeneration & {
  evidence: GrowthPersonalizationEvidence[]
  riskEvents: GrowthPersonalizationRiskEvent[]
  feedback: GrowthPersonalizationFeedback[]
}

export type GrowthPersonalizationProfile = {
  id: string
  leadId: string
  leadLabel: string
  personalizationScore: number
  evidenceCoverageScore: number
  topSources: GrowthPersonalizationSource[]
  updatedAt: string
}

export type GrowthPersonalizationPerformanceSnapshot = {
  id: string
  leadLabel: string
  sourceType: GrowthPersonalizationSource
  attributionScore: number
  replyRate: number | null
  meetingRate: number | null
  recordedAt: string
}

export type GrowthAiPersonalizationDashboard = {
  qa_marker: typeof GROWTH_AI_PERSONALIZATION_QA_MARKER
  generatedPersonalizations: number
  approvalQueue: number
  highRiskGenerations: number
  evidenceCoverage: number
  performanceAttribution: number
  topSources: Array<{ source: GrowthPersonalizationSource; count: number }>
  generations: GrowthPersonalizationGeneration[]
  recentEvidence: GrowthPersonalizationEvidence[]
  recentRiskEvents: GrowthPersonalizationRiskEvent[]
  recentFeedback: GrowthPersonalizationFeedback[]
  performanceSnapshots: GrowthPersonalizationPerformanceSnapshot[]
}

export type GrowthPersonalizationContext = {
  leadLabel: string
  companyName: string
  industryLabel: string | null
  relationshipStage: string | null
  relationshipSummary: string | null
  topObjections: string[]
  topPreferences: string[]
  opportunitySignals: string[]
  bookingSignals: string[]
  engagementTier: string | null
  territoryLabel: string | null
  websiteSignals: string[]
  committeeContext: string[]
  buyingSignals: string[]
  companySignals: string[]
  inboxHistory: string[]
  sequenceHistory: string[]
  templateOverlay: string | null
  sourcesUsed: GrowthPersonalizationSource[]
}

export function sanitizePersonalizationEvidenceSnippet(text: string, maxLength = 280): string {
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

export function maskPersonalizationLeadLabel(leadId: string, companyName?: string | null): string {
  if (companyName?.trim()) return companyName.trim().slice(0, 80)
  return `Account ${leadId.slice(0, 8)}…`
}

export function personalizationSourceLabel(source: GrowthPersonalizationSource): string {
  return source.replace(/_/g, " ")
}

export function personalizationStatusLabel(status: GrowthPersonalizationGenerationStatus): string {
  return status.replace(/_/g, " ")
}

export function riskLevelRank(level: GrowthPersonalizationRiskLevel): number {
  switch (level) {
    case "low":
      return 1
    case "medium":
      return 2
    case "high":
      return 3
    case "critical":
      return 4
    default:
      return 0
  }
}

export function highestRiskLevel(levels: GrowthPersonalizationRiskLevel[]): GrowthPersonalizationRiskLevel {
  if (levels.length === 0) return "low"
  return levels.reduce((best, current) => (riskLevelRank(current) > riskLevelRank(best) ? current : best))
}
