/** GS-AI-PLAYBOOK-3C — Outcome learning types (client-safe). */

import type { GrowthIndustryId } from "@/lib/growth/playbooks/industry-taxonomy"
import type {
  GrowthPersonaArchetype,
  GrowthPersonaCtaType,
  GrowthPersonaProofType,
} from "@/lib/growth/playbooks/personas/growth-playbook-persona-types"

export const GROWTH_PLAYBOOK_OUTCOME_QA_MARKER = "growth-playbook-outcome-gs-ai-playbook-3c-v1" as const

export const GROWTH_PLAYBOOK_OUTCOME_SAMPLE_THRESHOLDS = {
  low: 3,
  medium: 5,
  high: 10,
} as const

export type GrowthPlaybookOutcomeChannel = "EMAIL" | "SMS" | "VOICE" | "VIDEO" | "SHARE_PAGE" | "COPILOT"

export type GrowthPlaybookOutcomeNarrativeType = "operational" | "financial" | "growth"

export type GrowthPlaybookOutcomeRecord = {
  id: string
  industryId: GrowthIndustryId | string | null
  industryLabel: string | null
  personaArchetype: GrowthPersonaArchetype | null
  channel: GrowthPlaybookOutcomeChannel
  ctaType: GrowthPersonaCtaType | null
  proofType: GrowthPersonaProofType | null
  narrativeType: GrowthPlaybookOutcomeNarrativeType | null
  approved: boolean
  rejected: boolean
  regenerated: boolean
  operatorHelpful: boolean | null
  opened: boolean
  replied: boolean
  meetingBooked: boolean
  ctaClicked: boolean
  videoCompleted: boolean
  shareEngaged: boolean
  recordedAt: string
}

export type GrowthPlaybookOutcomeMetrics = {
  sampleSize: number
  approvalRate: number | null
  regenerationRate: number | null
  operatorHelpfulRate: number | null
  openRate: number | null
  replyRate: number | null
  meetingRate: number | null
  ctaRate: number | null
  videoCompletionRate: number | null
  shareEngagementRate: number | null
  freshnessDays: number
}

export type GrowthPlaybookOutcomeSegmentMetrics = GrowthPlaybookOutcomeMetrics & {
  segmentKey: string
  industryId: string | null
  personaArchetype: GrowthPersonaArchetype | null
  channel: GrowthPlaybookOutcomeChannel | null
  ctaType: GrowthPersonaCtaType | null
  proofType: GrowthPersonaProofType | null
  narrativeType: GrowthPlaybookOutcomeNarrativeType | null
}

export type GrowthPlaybookOutcomeGuidanceConfidence = "low" | "medium" | "high"

export type GrowthPlaybookOutcomeGuidance = {
  preferredProofTypes: GrowthPersonaProofType[]
  preferredCtaTypes: GrowthPersonaCtaType[]
  preferredNarratives: GrowthPlaybookOutcomeNarrativeType[]
  avoidPatterns: string[]
  confidence: GrowthPlaybookOutcomeGuidanceConfidence
  sampleSize: number
  freshnessDays: number
}

export type GrowthPlaybookOutcomeGuidanceDiagnostics = {
  guidanceApplied: boolean
  boosts: string[]
  deprioritized: string[]
  confidence: GrowthPlaybookOutcomeGuidanceConfidence
  sampleSize: number
  freshnessDays: number
  supportingMetrics: Partial<GrowthPlaybookOutcomeMetrics>
  winningPatterns: string[]
  avoidPatterns: string[]
}

export type GrowthPlaybookOutcomeGuidanceContext = {
  guidance: GrowthPlaybookOutcomeGuidance
  diagnostics: GrowthPlaybookOutcomeGuidanceDiagnostics
}

export type GrowthPlaybookOutcomeGuidanceFilter = {
  industryId?: GrowthIndustryId | string | null
  personaArchetype?: GrowthPersonaArchetype | null
  channel?: GrowthPlaybookOutcomeChannel | null
}

export type GrowthPlaybookOutcomeGuidanceInput = {
  records: GrowthPlaybookOutcomeRecord[]
  filter?: GrowthPlaybookOutcomeGuidanceFilter
  sampleThresholds?: Partial<typeof GROWTH_PLAYBOOK_OUTCOME_SAMPLE_THRESHOLDS>
}
