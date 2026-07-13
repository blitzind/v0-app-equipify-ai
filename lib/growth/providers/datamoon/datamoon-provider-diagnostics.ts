/** GE-DATAMOON-1A — Datamoon provider diagnostics. Client-safe. */

import {
  GROWTH_DATAMOON_PROVIDER_CONFIG_QA_MARKER,
  getDatamoonAudienceExtApiKey,
  getDatamoonAudienceModuleApiKey,
  getDatamoonEnrichmentApiKey,
  isDatamoonDryRunOnly,
  isDatamoonProviderConfigured,
  isDatamoonProviderEnabled,
  resolveDatamoonAudienceMode,
  resolveDatamoonAvailableCapabilities,
} from "@/lib/growth/providers/datamoon/datamoon-config"
import {
  GROWTH_DATAMOON_PROVIDER_DIAGNOSTICS_QA_MARKER,
  type DatamoonProviderDiagnostics,
} from "@/lib/growth/providers/datamoon/datamoon-types"

export { GROWTH_DATAMOON_PROVIDER_CONFIG_QA_MARKER, GROWTH_DATAMOON_PROVIDER_DIAGNOSTICS_QA_MARKER }

export function diagnoseDatamoonProvider(env: NodeJS.ProcessEnv = process.env): DatamoonProviderDiagnostics {
  const audienceMode = resolveDatamoonAudienceMode(env)
  const audience_ext_key_present = Boolean(getDatamoonAudienceExtApiKey(env))
  const audience_module_key_present = Boolean(getDatamoonAudienceModuleApiKey(env))
  const active_audience_key_present =
    audienceMode === "module" ? audience_module_key_present : audience_ext_key_present
  const alternate_audience_key_present =
    audienceMode === "module" ? audience_ext_key_present : audience_module_key_present
  return {
    qa_marker: GROWTH_DATAMOON_PROVIDER_DIAGNOSTICS_QA_MARKER,
    configured: isDatamoonProviderConfigured(env),
    enabled: isDatamoonProviderEnabled(env),
    dryRunOnly: isDatamoonDryRunOnly(env),
    audienceMode,
    availableCapabilities: resolveDatamoonAvailableCapabilities(env),
    enrichment_key_present: Boolean(getDatamoonEnrichmentApiKey(env)),
    audience_ext_key_present,
    audience_module_key_present,
    active_audience_key_present,
    alternate_audience_key_present,
    // Active mode key missing while the other mode's key exists — likely wrong DATAMOON_DEFAULT_MODE.
    mode_key_mismatch_risk: !active_audience_key_present && alternate_audience_key_present,
  }
}
