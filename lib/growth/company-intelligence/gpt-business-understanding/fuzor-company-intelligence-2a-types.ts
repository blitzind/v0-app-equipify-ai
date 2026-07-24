/**
 * FUZOR Company Intelligence — platform contracts (2A + PLATFORM-LIFT-1A).
 *
 * Identity (never collapse):
 *   Organization (owner)
 *     → AI Deployment (optional; reserved)
 *       → Organization Knowledge (deployment-specific; future)
 *   External Company
 *     → Company Intelligence (org-owned)
 *       → AI Employee Reasoning
 *
 * Layer 2 only. Separate from raw evidence and AI-employee reasoning.
 */

import type { FuzorCompanyBusinessUnderstanding } from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"

export const FUZOR_COMPANY_INTELLIGENCE_2A_QA_MARKER =
  "fuzor-company-intelligence-2a-canonical-platform-v1" as const

export const FUZOR_PLATFORM_LIFT_1A_QA_MARKER =
  "fuzor-platform-lift-1a-company-intelligence-v1" as const

export const FUZOR_COMPANY_INTELLIGENCE_2A_MIGRATION =
  "20270901120000_fuzor_company_intelligence_versions_2a" as const

export const FUZOR_COMPANY_INTELLIGENCE_OWNER_ORG_MIGRATION =
  "20270902120000_fuzor_company_intelligence_owner_org_lift_1a" as const

/** Platform document version (schema of understanding + refs). */
export const FUZOR_COMPANY_INTELLIGENCE_PLATFORM_VERSION = "fuzor-ci-2a-v1" as const

export const FUZOR_COMPANY_INTELLIGENCE_2A_GENERATION_MODE =
  "fuzor_gpt_business_understanding_2a" as const

/** Bridge marker when dedicated table is not yet applied. */
export const FUZOR_CI_BRIDGE_PROVIDER_SUMMARY = "fuzor_gpt_company_intelligence_2a" as const

export type FuzorCompanyIntelligenceEvidenceRefs = {
  leadId: string | null
  website: string | null
  linkedinCompanyUrl: string | null
  hasVerifiedDescription: boolean
  verifiedOfferingCount: number
  verifiedIndustryCount: number
  websiteExcerptCount: number
  pagesObserved: Array<{ url: string; pageType: string; status: string }>
  datamoonFindingCount: number
  missingFromCollection: string[]
  priorResearchNotesPresent: boolean
}

/**
 * Durable platform version record.
 * Ownership key: (ownerOrganizationId, externalCompanyId / companyId).
 */
export type FuzorCompanyIntelligenceVersionRecord = {
  id: string
  createdAt: string
  /** Organization A — operates the AI deployment; owns this intelligence. */
  ownerOrganizationId: string
  /** Reserved: multiple deployments per org share CI; knowledge stays deployment-specific. */
  aiDeploymentId: string | null
  /**
   * External company (Organization B) being understood.
   * Alias: externalCompanyId — same value as companyId for Growth companies table.
   */
  companyId: string | null
  /** Evidence adapter provenance (Growth Lead). Not a platform identity. */
  leadId: string | null
  companyName: string
  website: string | null
  model: string
  modelVersion: string | null
  promptVersion: string
  companyIntelligenceVersion: string
  evidenceVersion: string
  evidenceFingerprint: string
  understanding: FuzorCompanyBusinessUnderstanding
  evidenceRefs: FuzorCompanyIntelligenceEvidenceRefs
  generationMetadata: Record<string, unknown>
  generationDurationMs: number | null
  promptTokens: number | null
  completionTokens: number | null
  qaMarker: string
  generationMode: string
  storageBackend: "fuzor_versions_table" | "company_intelligence_runs_bridge"
}

export type EnsureCompanyIntelligenceResult =
  | {
      ok: true
      reused: boolean
      regenerated: boolean
      reason:
        | "reused_matching_evidence"
        | "regenerated_new_evidence"
        | "regenerated_forced"
        | "regenerated_no_prior"
      record: FuzorCompanyIntelligenceVersionRecord
    }
  | {
      ok: false
      code:
        | "lead_not_found"
        | "organization_unavailable"
        | "model_failed"
        | "persist_failed"
        | "company_unresolved"
        | "evidence_adapter_required"
        | "forbidden_cross_tenant"
        | "owner_organization_required"
      message: string
    }

/** What AI employees should consume — understanding + identity, not generation internals. */
export type CompanyIntelligenceForAiEmployee = {
  ownerOrganizationId: string
  aiDeploymentId: string | null
  companyId: string | null
  externalCompanyId: string | null
  leadId: string | null
  companyName: string
  website: string | null
  companyIntelligenceVersionId: string
  companyIntelligenceVersion: string
  evidenceFingerprint: string
  createdAt: string
  understanding: FuzorCompanyBusinessUnderstanding
  evidenceRefs: FuzorCompanyIntelligenceEvidenceRefs
}
