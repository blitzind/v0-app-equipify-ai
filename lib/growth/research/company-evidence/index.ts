/** GE-AIOS-22 — Company evidence module exports (client-safe surface). */

export {
  GROWTH_COMPANY_EVIDENCE_22_QA_MARKER,
  GROWTH_COMPANY_EVIDENCE_PHASE,
  type GrowthCompanyEvidenceBundle,
  type GrowthCompanyEvidenceCrawlState,
  type GrowthCompanyEvidenceField,
  type GrowthCompanyEvidenceListField,
  type GrowthCompanyEvidenceMissionComparison,
  type GrowthCompanyEvidenceMissionMatchLabel,
  type GrowthCompanyEvidenceProfile,
  type GrowthCompanyEvidenceQualificationDecision,
  type GrowthCompanyEvidenceQualificationExplanation,
  type GrowthCompanyEvidenceQualityScores,
} from "@/lib/growth/research/company-evidence/company-evidence-types"

export {
  buildCompanyEvidenceProfileFromRawItems,
  collectCompanyEvidenceSourceUrls,
} from "@/lib/growth/research/company-evidence/build-company-evidence-profile"

export {
  COMPANY_EVIDENCE_CONFIDENCE_THRESHOLD,
  COMPANY_EVIDENCE_MAX_PAGES,
  buildCompanyEvidenceMissingInformation,
  evaluateCompanyEvidenceCrawlStop,
  finalizeCompanyEvidenceCrawlState,
} from "@/lib/growth/research/company-evidence/company-evidence-crawl-budget"

export { computeCompanyEvidenceQualityScores } from "@/lib/growth/research/company-evidence/company-evidence-quality-score"

export { compareCompanyEvidenceToMission } from "@/lib/growth/research/company-evidence/company-evidence-mission-comparison"

export { buildCompanyEvidenceQualificationExplanation } from "@/lib/growth/research/company-evidence/company-evidence-explainability"

export {
  COMPANY_EVIDENCE_CACHE_TTL_MS,
  shouldRefreshCompanyEvidence,
} from "@/lib/growth/research/company-evidence/company-evidence-cache"

export {
  enrichCompanyIntelligenceFromEvidence,
  mergeEvidenceIntoResearchSummary,
  resolveVerifiedIndustryGuess,
  type GrowthCompanyIntelligenceEvidenceEnrichment,
} from "@/lib/growth/research/company-evidence/company-evidence-intelligence-enrichment"

export {
  GROWTH_PROSPECT_KNOWLEDGE_PACK_QA_MARKER,
  buildProspectKnowledgePack,
  type ProspectKnowledgePack,
  type ProspectKnowledgeConclusion,
} from "@/lib/growth/research/company-evidence/prospect-knowledge-pack"
