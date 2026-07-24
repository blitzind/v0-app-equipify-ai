/**
 * AVA-SIMPLE-OUTREACH-2A — Lean evidence contract for GPT reasoning.
 * Software gathers/organizes; GPT determines fit, angle, contact, and email.
 */

export const AVA_SIMPLE_OUTREACH_1A_QA_MARKER = "ava-simple-outreach-1a-direct-reasoning-v1" as const

/** Current lean-reasoning QA marker (2A). */
export const AVA_SIMPLE_OUTREACH_2A_QA_MARKER = "ava-simple-outreach-2a-lean-reasoning-v1" as const

/** @deprecated Prefer AVA_SIMPLE_OUTREACH_2A_QA_MARKER */
export const AVA_SIMPLE_OUTREACH_QA_MARKER = AVA_SIMPLE_OUTREACH_2A_QA_MARKER

export const AVA_DIRECT_REASONING_GENERATION_MODE = "ava_direct_reasoning_2a" as const

export const AVA_DIRECT_OUTREACH_PROMPT_VERSION = "ava-simple-outreach-2a-v1" as const

export const AVA_DIRECT_OUTREACH_MODEL = "gpt-5.5" as const

export type AvaDirectOutreachDecision = "outreach" | "reject" | "needs_more_research"

/**
 * Lean context: original evidence preferred over scores/abstractions.
 * Software organizes; GPT reasons.
 */
export type AvaDirectOutreachContext = {
  company: {
    name: string
    website: string | null
    location: string | null
    leadId: string
  }
  decisionMaker: {
    name: string | null
    title: string | null
    email: string | null
    linkedinUrl: string | null
  }
  verifiedCompanyDescription: string | null
  verifiedProductsServices: string[]
  verifiedOperationalCapabilities: string[]
  researchSummary: string | null
  relevantWebsiteExcerpts: string[]
  datamoonFindings: string[]
  knownRisks: string[]
  missingInformation: string[]
  equipifyBusinessProfile: {
    name: string
    productName: string
    productSummary: string
    idealCustomerSummary: string
    approvedCapabilities: string[]
    approvedValuePropositions: string[]
    disqualifiers: string[]
  }
}

export type AvaDirectOutreachEmail = {
  subject: string
  body: string
}

export type AvaDirectOutreachResult = {
  decision: AvaDirectOutreachDecision
  confidence: number
  fitSummary: string
  supportingReasons: string[]
  concerns: string[]
  recommendedContactRole: string | null
  salesAngle: string | null
  email: AvaDirectOutreachEmail | null
  evidenceUsed: string[]
  missingInformation: string[]
}

export type AvaDirectOutreachRunOutput = {
  qaMarker: typeof AVA_SIMPLE_OUTREACH_2A_QA_MARKER
  generationMode: typeof AVA_DIRECT_REASONING_GENERATION_MODE
  organizationId: string
  leadId: string
  companyName: string
  contact: AvaDirectOutreachContext["decisionMaker"]
  context: AvaDirectOutreachContext
  result: AvaDirectOutreachResult
  provider: string | null
  model: string | null
  /** Model attempts used (1 = no retry; 2 = retried once). */
  modelAttempts: number
  persistedGenerationId: string | null
  outboundAuthorized: false
}
