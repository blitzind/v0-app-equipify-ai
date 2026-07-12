/** SV1-4 — DataMoon decision-maker enrichment public surface. */

export {
  AI_OS_DATAMOON_DM_DEFAULT_TITLE_FAMILIES,
  AI_OS_DATAMOON_DM_DENY_REASONS,
  AI_OS_DATAMOON_DM_OUTCOMES,
  AI_OS_DATAMOON_DM_QA_MARKER,
  AI_OS_DATAMOON_DM_RETRY,
  type AiOsDatamoonDmAuthorization,
  type AiOsDatamoonDmCandidate,
  type AiOsDatamoonDmContactReadiness,
  type AiOsDatamoonDmDecision,
  type AiOsDatamoonDmDenyReason,
  type AiOsDatamoonDmExplainability,
  type AiOsDatamoonDmOutcome,
  type AiOsDatamoonDmRequirement,
} from "@/lib/growth/datamoon-decision-maker/datamoon-dm-types"

export {
  authorizeDatamoonPersonEnrichment,
  buildDatamoonAudienceFiltersForDecisionMaker,
  buildDatamoonPersonSearchIdempotencyKey,
  decideDatamoonDecisionMakerEnrichment,
  evaluateDecisionMakerContactReadiness,
  isExistingDecisionMakerIncompleteWorthEnriching,
  isExistingDecisionMakerSufficient,
  mergeContactPreferringVerified,
  projectDecisionMakerRequirement,
  rankDatamoonDecisionMakerCandidates,
  selectBestDatamoonDecisionMaker,
} from "@/lib/growth/datamoon-decision-maker/datamoon-dm-engine"

export { normalizeDatamoonRecordsToDecisionMakerCandidates } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-normalize"
