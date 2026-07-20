/**
 * GE-AIOS-FIRST-CUSTOMER-SUPERVISED-SALES-1B — Shared types (client-safe).
 */

export const GROWTH_AIOS_FIRST_CUSTOMER_SUPERVISED_SALES_1B_QA_MARKER =
  "ge-aios-first-customer-supervised-sales-1b-v1" as const

export type SupervisedSalesRuntimeComponentId =
  | "discovery"
  | "research"
  | "provider_bridge"
  | "operational_keyword_validation"
  | "admission"
  | "seller_truth"
  | "sales_strategy_brief"
  | "approval_package"
  | "human_approval"
  | "outbound_kill_switch"

export type SupervisedSalesRuntimeComponentAudit = {
  id: SupervisedSalesRuntimeComponentId
  label: string
  status: "present" | "partial" | "missing"
  locations: string[]
  notes?: string
}

export type SupervisedSalesProductionLeadCandidate = {
  leadId: string
  companyName: string | null
  admissionState: string
  outreachEligible: boolean
  hasResearch: boolean
  researchRunId: string | null
  lastResearchedAt: string | null
  contactName: string | null
  contactTitle: string | null
  industry: string | null
  website: string | null
  qualityScore: number
  scoreBreakdown: Record<string, number>
  existingPackageId: string | null
}

export type SupervisedSalesOperatorPackageSection = {
  executiveSummary: string
  whyBuy: string
  companySummary: string
  industry: string | null
  operations: string[]
  equipment: string[]
  fieldWorkforce: string[]
  likelyWorkflow: string[]
  growthStage: string | null
  painPoints: string[]
  equipifySolution: string
  recommendedPackage: string
  packageRationale: string
  decisionMakers: Array<{
    name: string | null
    title: string | null
    confidence: string | null
    evidence: string[]
    missing: string[]
  }>
  outreach: {
    email: string | null
    linkedIn: string | null
    phoneOpening: string | null
    voicemail: string | null
    followUp: string | null
  }
  objections: Array<{ objection: string; response: string }>
  approvalSummary: string[]
  missingInformation: string[]
}

export type SupervisedSalesWorkflowDimensionScore = {
  dimension: string
  score: number
  notes: string
}

export type SupervisedSalesWorkflowBlocker = {
  id: string
  severity: "critical" | "high" | "medium" | "low"
  description: string
  remediation: string
}

export type SupervisedSalesProductionReport = {
  qaMarker: typeof GROWTH_AIOS_FIRST_CUSTOMER_SUPERVISED_SALES_1B_QA_MARKER
  organizationId: string
  generatedAt: string
  runtimeAudit: SupervisedSalesRuntimeComponentAudit[]
  outboundKillSwitchEnabled: boolean
  selectedLeads: SupervisedSalesProductionLeadCandidate[]
  packages: Array<{
    leadId: string
    companyName: string | null
    packageId: string | null
    source: "existing" | "preview_generated"
    operatorPackage: SupervisedSalesOperatorPackageSection
  }>
  workflowScores: SupervisedSalesWorkflowDimensionScore[]
  overallReadinessScore: number
  blockers: SupervisedSalesWorkflowBlocker[]
  supervisedCycleReady: boolean
  admissionPoolSummary?: {
    totalActiveLeads: number
    outreachEligible: number
    accepted: number
    review: number
  }
}
