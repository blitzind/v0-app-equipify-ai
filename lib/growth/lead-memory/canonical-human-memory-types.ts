/** GE-AIOS-MEMORY-RESOLVER-1A — Canonical human memory bundle types (client-safe). */

import type { AdaptiveProspectEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import type { GrowthCanonicalDisplayIdentity } from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b-types"
import type { GrowthInstitutionalSalesIntelligence } from "@/lib/growth/aios/growth/growth-institutional-learning-1a-types"
import type { GrowthOutreachLearningThemeWeight } from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import type { GrowthOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import type { RevenueStrategyBuyingCommitteeSnapshot } from "@/lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import type { RelationshipAssessmentContextSignals } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"
import type {
  GrowthLeadMemoryCategory,
  GrowthLeadMemoryInfluenceContext,
  GrowthMemoryConfidence,
} from "@/lib/growth/lead-memory/memory-types"

export const GROWTH_CANONICAL_HUMAN_MEMORY_RESOLVER_QA_MARKER =
  "ge-aios-memory-resolver-1a-v1" as const

/** Extended human-memory taxonomy — stored via metadata.humanMemoryKind on lead_memory_events. */
export const HUMAN_MEMORY_KINDS = [
  "business_fact",
  "personal_context",
  "communication_style",
  "sales_conclusion",
  "action_commitment",
] as const
export type HumanMemoryKind = (typeof HUMAN_MEMORY_KINDS)[number]

export const MEMORY_OPERATOR_STATUSES = [
  "pending",
  "approved",
  "corrected",
  "deleted",
  "pinned",
  "protected",
] as const
export type MemoryOperatorStatus = (typeof MEMORY_OPERATOR_STATUSES)[number]

export type CanonicalMemoryRecord = {
  id: string
  conclusion: string
  humanMemoryKind: HumanMemoryKind | null
  memoryCategory: GrowthLeadMemoryCategory
  confidence: GrowthMemoryConfidence
  sourceSystem: string
  recordedAt: string
  lastConfirmedAt: string | null
  confirmationCount: number
  freshnessExpiresAt: string | null
  operatorStatus: MemoryOperatorStatus
  superseded: boolean
  pinned: boolean
  protected: boolean
  whyItMatters: string | null
  canonicalEntityLabel: string | null
}

export type BusinessMemorySlice = {
  companyName: string | null
  industry: string | null
  equipment: string[]
  growthInitiatives: string[]
  currentSoftware: string[]
  competitiveLandscape: string[]
  operationalPriorities: string[]
  records: CanonicalMemoryRecord[]
}

export type PersonalMemorySlice = {
  communicationStyle: string[]
  personalityNotes: string[]
  preferredTerminology: string[]
  personalContext: string[]
  records: CanonicalMemoryRecord[]
}

export type RelationshipMemorySlice = {
  stage: string | null
  summary: string | null
  engagementTrend: string | null
  trustSignals: string[]
  champions: string[]
  blockers: string[]
  meetingHistory: string[]
  commitments: string[]
  records: CanonicalMemoryRecord[]
}

export type SalesMemorySlice = {
  painPoints: string[]
  businessPressures: string[]
  objections: string[]
  buyingTriggers: string[]
  questionsThatWorked: string[]
  questionsThatFailed: string[]
  records: CanonicalMemoryRecord[]
}

export type ActionMemorySlice = {
  openCommitments: string[]
  promisedFollowUps: string[]
  pendingDocuments: string[]
  requestedInformation: string[]
  records: CanonicalMemoryRecord[]
}

export type MemoryFreshnessSummary = {
  generatedAt: string
  totalActiveRecords: number
  expiredPersonalSensitivityCount: number
  lowConfidenceSuppressedCount: number
  operatorApprovedCount: number
  stalePackageSnapshot: boolean
}

export type CanonicalHumanMemoryBundle = {
  qaMarker: typeof GROWTH_CANONICAL_HUMAN_MEMORY_RESOLVER_QA_MARKER
  leadId: string
  organizationId: string
  generatedAt: string
  identity: GrowthCanonicalDisplayIdentity
  influence: GrowthLeadMemoryInfluenceContext
  business: BusinessMemorySlice
  personal: PersonalMemorySlice
  relationship: RelationshipMemorySlice
  sales: SalesMemorySlice
  actions: ActionMemorySlice
  committee: RevenueStrategyBuyingCommitteeSnapshot | null
  institutionalAdvisory: GrowthInstitutionalSalesIntelligence | null
  packageSnapshot: GrowthOutreachSalesStrategyBrief | null
  liveDeltas: AdaptiveProspectEvent[]
  freshness: MemoryFreshnessSummary
  relationshipContext: RelationshipAssessmentContextSignals
  learningWeights: GrowthOutreachLearningThemeWeight[] | null
  institutionalAdvice: string[]
  profileViewAvailable: boolean
}
