/**
 * FUZOR-COMPANY-INTELLIGENCE-1A — GPT business understanding contracts.
 * Vendor-neutral: understands a company. No Equipify / ICP / sales fit.
 */

export const FUZOR_COMPANY_INTELLIGENCE_1A_QA_MARKER =
  "fuzor-company-intelligence-1a-gpt-business-understanding-v1" as const

export const FUZOR_COMPANY_INTELLIGENCE_PROMPT_VERSION =
  "fuzor-company-intelligence-gpt-first-1a-v1" as const

export const FUZOR_COMPANY_INTELLIGENCE_GPT_FIRST_1A_QA_MARKER =
  "fuzor-company-intelligence-gpt-first-1a-v1" as const

export const FUZOR_COMPANY_INTELLIGENCE_MODEL = "gpt-5.5" as const

export const FUZOR_COMPANY_INTELLIGENCE_GENERATION_MODE =
  "fuzor_gpt_business_understanding_1a" as const

/** Evidence packet gathered by software — no interpretation scores. */
export type FuzorCompanyIntelligenceEvidencePacket = {
  companyName: string
  website: string | null
  leadId: string | null
  linkedinCompanyUrl: string | null
  verifiedDescription: string | null
  verifiedOfferings: string[]
  verifiedIndustries: string[]
  verifiedCustomers: string[]
  verifiedMarkets: string[]
  verifiedDifferentiators: string[]
  verifiedTechnologySignals: string[]
  verifiedHiringSignals: string[]
  websiteExcerpts: string[]
  pagesObserved: Array<{
    url: string
    pageType: string
    status: string
  }>
  datamoonFindings: string[]
  priorResearchNotes: string | null
  missingFromCollection: string[]
}

export type FuzorEvidenceCitation = {
  claim: string
  evidence: string[]
}

export type FuzorCompanyBusinessUnderstanding = {
  executiveSummary: string
  revenueModel: {
    summary: string
    models: string[]
    evidence: string[]
  }
  productsAndServices: {
    offerings: string[]
    notes: string | null
    evidence: string[]
  }
  operationalModel: {
    summary: string
    characteristics: string[]
    evidence: string[]
  }
  customers: {
    summary: string
    segments: string[]
    evidence: string[]
  }
  industriesServed: {
    industries: string[]
    evidence: string[]
  }
  operationalChallenges: {
    challenges: Array<{
      challenge: string
      why: string
      evidence: string[]
    }>
  }
  companyStrengths: {
    strengths: string[]
    evidence: string[]
  }
  unknowns: string[]
  evidenceUsed: string[]
  evidenceWeakness: string | null
}

export type FuzorCompanyIntelligenceRunOutput = {
  qaMarker: typeof FUZOR_COMPANY_INTELLIGENCE_1A_QA_MARKER
  generationMode: typeof FUZOR_COMPANY_INTELLIGENCE_GENERATION_MODE
  leadId: string
  companyName: string
  website: string | null
  evidencePacket: FuzorCompanyIntelligenceEvidencePacket
  understanding: FuzorCompanyBusinessUnderstanding
  provider: string | null
  model: string | null
  modelAttempts: number
  durationMs: number
  promptTokens: number | null
  completionTokens: number | null
}
