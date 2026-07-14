/** GE-AIOS-CALL-WORKSPACE-INTELLIGENCE-2A — AI OS live reasoning types (client-safe). */

import type { GrowthOutreachConsultantDiscoveryIntelligence } from "@/lib/growth/aios/growth/growth-outreach-consultant-discovery-intelligence"
import type { GrowthOutreachRevenueStrategyIntelligence } from "@/lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import type { GrowthOutreachRelationshipAssessment } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"

export const GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER =
  "ge-aios-call-workspace-intelligence-2a-v1" as const

export type CallWorkspaceAiosScenarioBranch = {
  trigger: string
  response: string
}

export type CallWorkspaceAiosSayThisNext = {
  currentObjective: string
  recommendedNextSentence: string
  why: string
  confidence: number
  businessPressure: string | null
  expectedOutcome: string | null
  alternativeResponse: string | null
  recoveryResponse: string | null
  scenarioBranches: CallWorkspaceAiosScenarioBranch[]
}

export type CallWorkspaceAiosLiveReasoningSnapshot = {
  qaMarker: typeof GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER
  generatedAt: string
  leadId: string
  triggeredBySequenceNumber: number | null
  conversationStage: string | null
  buyingIntent: string | null
  riskLevel: string | null
  relationshipMovement: string | null
  operationalProblem: string | null
  discoveryProgress: string | null
  conversationMomentum: string | null
  recommendedNextObjective: string | null
  sayThisNext: CallWorkspaceAiosSayThisNext
  relationshipHealth: string | null
  trustBudget: string | null
  momentum: string | null
  opportunityReadiness: string | null
  committeeStatus: string | null
  institutionalAdvisory: string[]
  buyingSignals: string[]
  conversationRisks: string[]
  opportunitySignals: string[]
  confidenceLevel: string
  consultantDiscoveryIntelligence: GrowthOutreachConsultantDiscoveryIntelligence | null
  revenueStrategyIntelligence: GrowthOutreachRevenueStrategyIntelligence | null
  relationshipAssessment: GrowthOutreachRelationshipAssessment | null
}
