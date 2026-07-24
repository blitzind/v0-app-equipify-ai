export {
  FUZOR_COMPANY_INTELLIGENCE_1A_QA_MARKER,
  FUZOR_COMPANY_INTELLIGENCE_GENERATION_MODE,
  FUZOR_COMPANY_INTELLIGENCE_MODEL,
  FUZOR_COMPANY_INTELLIGENCE_PROMPT_VERSION,
  type FuzorCompanyBusinessUnderstanding,
  type FuzorCompanyIntelligenceEvidencePacket,
  type FuzorCompanyIntelligenceRunOutput,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"

export {
  FUZOR_COMPANY_INTELLIGENCE_2A_QA_MARKER,
  FUZOR_COMPANY_INTELLIGENCE_2A_MIGRATION,
  FUZOR_COMPANY_INTELLIGENCE_OWNER_ORG_MIGRATION,
  FUZOR_COMPANY_INTELLIGENCE_2A_GENERATION_MODE,
  FUZOR_COMPANY_INTELLIGENCE_PLATFORM_VERSION,
  FUZOR_PLATFORM_LIFT_1A_QA_MARKER,
  type CompanyIntelligenceForAiEmployee,
  type EnsureCompanyIntelligenceResult,
  type FuzorCompanyIntelligenceVersionRecord,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-2a-types"

export {
  gatherFuzorCompanyIntelligenceEvidence,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-evidence-gatherer"

export {
  loadLegacyDeterministicCompanyInterpretation,
  type LegacyDeterministicCompanyInterpretation,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-legacy-comparison"

export {
  runFuzorCompanyIntelligence,
  type RunFuzorCompanyIntelligenceInput,
  type RunFuzorCompanyIntelligenceResult,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-service"

export {
  fuzorCompanyBusinessUnderstandingSchema,
  normalizeFuzorCompanyBusinessUnderstanding,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-schema"

export {
  ensureCompanyIntelligence,
  loadCompanyIntelligence,
  consumeCompanyIntelligenceForAiEmployee,
  companyIntelligenceUnderstandingFingerprint,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-platform"

export {
  ensureCompanyIntelligenceForGrowthLead,
  loadCompanyIntelligenceForGrowthLead,
  consumeCompanyIntelligenceForGrowthLead,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-growth-lead-adapter"

export {
  isFuzorCompanyIntelligenceVersionsSchemaReady,
  fuzorCompanyIntelligenceSchemaNotReadyMessage,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-repository"

export {
  FUZOR_COMPANY_INTELLIGENCE_CONSUMER_MIGRATION_AUDIT,
  estimateDuplicatedInterpretationReductionPercent,
} from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-consumer-migration-audit"
