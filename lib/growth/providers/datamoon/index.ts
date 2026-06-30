/** Client-safe Datamoon barrel — server-only modules import paths directly. */

export {
  GROWTH_DATAMOON_PROVIDER_CONFIG_QA_MARKER,
  DATAMOON_ENRICHMENT_BASE_URL,
  DATAMOON_AUDIENCE_EXT_BASE_URL,
  DATAMOON_AUDIENCE_MODULE_BASE_URL,
  DATAMOON_ENRICH_BY_EMAIL_PATH,
  DATAMOON_ENRICH_BY_PHONE_PATH,
  getDatamoonAudienceApiKey,
  getDatamoonAudienceExtApiKey,
  getDatamoonAudienceModuleApiKey,
  getDatamoonEnrichmentApiKey,
  isDatamoonAudienceConfigured,
  isDatamoonDryRunOnly,
  isDatamoonEnrichmentConfigured,
  isDatamoonProviderConfigured,
  isDatamoonProviderEnabled,
  resolveDatamoonAudienceBaseUrl,
  resolveDatamoonAudienceMode,
  resolveDatamoonAvailableCapabilities,
  type DatamoonAudienceMode,
  type DatamoonProviderCapability,
} from "@/lib/growth/providers/datamoon/datamoon-config"
export {
  GROWTH_DATAMOON_PROVIDER_DIAGNOSTICS_QA_MARKER,
  GROWTH_DATAMOON_PROVIDER_QA_MARKER,
  type DatamoonAudienceBuildResponse,
  type DatamoonAudienceFetchResponse,
  type DatamoonBuildAudienceInput,
  type DatamoonClientResult,
  type DatamoonEnrichByEmailInput,
  type DatamoonEnrichByPhoneInput,
  type DatamoonExportAudienceInput,
  type DatamoonProviderDiagnostics,
} from "@/lib/growth/providers/datamoon/datamoon-types"
export {
  diagnoseDatamoonProvider,
} from "@/lib/growth/providers/datamoon/datamoon-provider-diagnostics"
