/** Phase GS-2A — Natural Language Prospect Discovery Foundation exports. */

export {
  PROSPECT_DISCOVERY_EXECUTE_CONFIRM,
  PROSPECT_DISCOVERY_PROVIDERS,
  PROSPECT_DISCOVERY_QA_MARKER,
  PROSPECT_SEARCH_RESULT_QUALITY_LEVELS,
  PROSPECT_SEARCH_SIGNAL_TYPES,
  type NormalizedProspectSearchIntent,
  type ProspectDiscoveryProvider,
  type ProspectSearchIntent,
  type ProspectSearchParseResponse,
  type ProspectSearchPlan,
  type ProspectSearchResultQuality,
  type ProspectSearchSignalType,
  type ProspectSearchSuggestion,
  type ProspectSearchSuggestionsResponse,
} from "@/lib/growth/prospect-discovery/prospect-search-intent-types"

export { parseProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-parser"
export { normalizeProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-normalizer"
export { buildProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-plan-builder"
export { buildProspectSearchSuggestions } from "@/lib/growth/prospect-discovery/prospect-search-suggestions"

export {
  PROSPECT_DISCOVERY_READINESS_CHECKLIST,
  assertProspectDiscoveryExecuteAllowed,
  buildProspectDiscoveryReadinessPayload,
  executeProspectDiscoveryFoundationCertification,
  validateProspectDiscoveryCertificationConfirmation,
} from "@/lib/growth/prospect-discovery/prospect-search-certification"
