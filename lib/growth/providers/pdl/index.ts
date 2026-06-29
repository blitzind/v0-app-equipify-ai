/** Client-safe PDL barrel — server-only modules import paths directly. */

export {
  GROWTH_PDL_PROVIDER_QA_MARKER,
  type PdlCompanyEnrichInput,
  type PdlCompanyEnrichResult,
  type PdlCompanyRecord,
  type PdlPersonEnrichInput,
  type PdlPersonEnrichResult,
  type PdlPersonRecord,
  type PdlPersonSearchInput,
  type PdlPersonSearchResult,
} from "@/lib/growth/providers/pdl/pdl-types"
export {
  GROWTH_PDL_PROVIDER_CONFIG_QA_MARKER,
  getPdlApiKey,
  isPdlApiConfigured,
  isPdlContactDiscoveryEnabled,
  isPdlDiscoveryDisabled,
  isPdlMockEnabled,
  isPdlProviderConfigured,
  isPdlSandboxEnabled,
  resolvePdlApiBaseUrl,
  resolvePdlCompanyEnrichBaseUrl,
  resolvePdlCreditLimits,
  resolvePdlPersonEnrichBaseUrl,
  resolvePdlPersonSearchBaseUrl,
  resolvePdlSandboxEnvConfig,
  resolveContactsPerCompanyLimit,
} from "@/lib/growth/providers/pdl/pdl-config"
export {
  GROWTH_PDL_CONFIG_DIAGNOSTICS_QA_MARKER,
  assertPdlLiveBenchmarkAllowed,
  diagnosePdlContactDiscoveryConfig,
  type PdlConfigDiagnostics,
} from "@/lib/growth/providers/pdl/pdl-config-diagnostics"
export {
  GROWTH_PDL_PROVIDER_FUSION_QA_MARKER,
  resolveProductionProviderFusionPlan,
  type ProviderFusionChannel,
  type ProviderFusionPlan,
} from "@/lib/growth/providers/pdl/pdl-provider-fusion"
export { buildPdlPersonSearchQuery } from "@/lib/growth/providers/pdl/pdl-query-builder"
export { mapPdlPeopleToContactDiscoveryRaw, mapPdlPersonToContactDiscoveryRaw } from "@/lib/growth/providers/pdl/pdl-person-mapper"
