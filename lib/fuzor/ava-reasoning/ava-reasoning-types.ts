/**
 * FUZOR Ava Reasoning — reusable Layer 3 contracts (AVA-COMPANY-INTELLIGENCE-INTEGRATION-1A).
 *
 * Company Intelligence + Organization Knowledge + Role + Objective + Contacts
 * → GPT-5.5 sales judgment → structured decision.
 *
 * No Equipify-specific business facts belong here.
 */

import type { CompanyIntelligenceForAiEmployee } from "@/lib/fuzor/company-intelligence"

export const AVA_CI_INTEGRATION_1A_QA_MARKER =
  "ava-company-intelligence-integration-1a-reasoning-v1" as const

export const AVA_REASONING_GENERATION_MODE = "ava_ci_reasoning_1a" as const

export const AVA_REASONING_PROMPT_VERSION = "ava-ci-integration-1a-v1" as const

export const AVA_REASONING_MODEL = "gpt-5.5" as const

export type AvaReasoningDecision = "pursue" | "hold" | "reject"

/** Deployment-supplied knowledge about the organization Ava represents. */
export type AvaOrganizationKnowledge = {
  source: string
  versionId: string | null
  organizationName: string
  identitySummary: string | null
  productsAndCapabilities: string[]
  customersServed: string[]
  problemsSolved: string[]
  differentiators: string[]
  positioning: string[]
  approvedTerminologyPrefer: string[]
  approvedTerminologyAvoid: string[]
  customerOutcomes: string[]
  limitations: string[]
  disqualifiers: string[]
}

/** Reusable agent role — no customer/org product facts. */
export type AvaRoleKnowledge = {
  roleId: string
  roleName: string
  summary: string
  responsibilities: string[]
  constraints: string[]
}

/** Factual contact evidence — no persona-fit scores. */
export type AvaContactEvidence = {
  contactId: string
  name: string
  title: string | null
  role: string | null
  email: string | null
  linkedinUrl: string | null
  companyAssociation: string | null
  professionalSummary: string | null
  contactabilityStatus: "contactable" | "email_missing" | "rejected" | "unknown"
  evidenceSource: string
  evidenceExcerpt: string | null
}

/**
 * Software-authoritative controls GPT must not override.
 *
 * outboundSendAuthorized=false means the platform will not send email.
 * It does NOT mean Ava should hold or skip drafting for review.
 */
export type AvaHardRuleState = {
  /** Always false in this milestone — transport remains disabled. */
  outboundSendAuthorized: false
  /** Drafts for human review are allowed when pursuit is justified. */
  draftGenerationAllowed: true
  optOutBlocked: boolean
  suppressed: boolean
  persistenceEnabled: boolean
}

export type AvaReasoningRecommendedContact = {
  contactId: string | null
  name: string | null
  title: string | null
  reason: string
}

export type AvaReasoningEmail = {
  subject: string
  body: string
}

export type AvaReasoningResult = {
  decision: AvaReasoningDecision
  rationale: string
  strongestAngle: string | null
  recommendedContact: AvaReasoningRecommendedContact | null
  missingInformation: string[]
  email: AvaReasoningEmail | null
  evidenceReferences: string[]
}

export type RunAvaReasoningInput = {
  ownerOrganizationId: string
  aiDeploymentId?: string | null
  companyIntelligence: CompanyIntelligenceForAiEmployee
  organizationKnowledge: AvaOrganizationKnowledge
  roleKnowledge: AvaRoleKnowledge
  objective: string
  contacts: AvaContactEvidence[]
  hardRuleState: AvaHardRuleState
  actingUserEmail: string
  /** Test seam */
  runModel?: AvaReasoningModelRunner
}

export type AvaReasoningModelRunner = (input: {
  organizationId: string
  actingUserEmail: string
  systemPrompt: string
  userPrompt: string
}) => Promise<{
  result: AvaReasoningResult
  provider: string | null
  model: string | null
  attempts: number
  durationMs: number
  promptTokens: number | null
  completionTokens: number | null
}>

export type RunAvaReasoningOutput = {
  qaMarker: typeof AVA_CI_INTEGRATION_1A_QA_MARKER
  generationMode: typeof AVA_REASONING_GENERATION_MODE
  ownerOrganizationId: string
  aiDeploymentId: string | null
  companyName: string
  companyIntelligenceVersionId: string
  evidenceFingerprint: string
  organizationKnowledgeSource: string
  organizationKnowledgeVersionId: string | null
  objective: string
  contactsSupplied: AvaContactEvidence[]
  result: AvaReasoningResult
  provider: string | null
  model: string | null
  modelAttempts: number
  durationMs: number
  promptTokens: number | null
  completionTokens: number | null
  outboundSendAuthorized: false
  persistenceStatus: "disabled" | "not_requested"
}
