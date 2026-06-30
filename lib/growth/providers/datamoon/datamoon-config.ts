/** Datamoon lead-source provider configuration — client-safe env resolution (GE-DATAMOON-1A). */

export const GROWTH_DATAMOON_PROVIDER_CONFIG_QA_MARKER =
  "growth-datamoon-provider-config-ge-datamoon-1a-v1" as const

export const DATAMOON_ENRICHMENT_BASE_URL = "https://app.datamoon.com/api/v2" as const
export const DATAMOON_AUDIENCE_EXT_BASE_URL = "https://app.datamoon.com/api/v2/ext" as const
export const DATAMOON_AUDIENCE_MODULE_BASE_URL = "https://app.datamoon.com/api/v2/m" as const

export const DATAMOON_ENRICH_BY_EMAIL_PATH = "/GetDataByEmail" as const
export const DATAMOON_ENRICH_BY_PHONE_PATH = "/GetDataByPhone" as const

export const DATAMOON_DEFAULT_REQUEST_TIMEOUT_MS = 15_000 as const
export const DATAMOON_DEFAULT_MAX_RETRIES = 1 as const

export type DatamoonAudienceMode = "ext" | "module"

export type DatamoonProviderCapability =
  | "audience_build"
  | "audience_poll"
  | "enrichment_email"
  | "enrichment_phone"

function parseTruthy(raw: string | undefined): boolean {
  const lower = raw?.trim().toLowerCase()
  return lower === "1" || lower === "true" || lower === "yes"
}

function parseExplicitFalse(raw: string | undefined): boolean {
  const lower = raw?.trim().toLowerCase()
  return lower === "0" || lower === "false" || lower === "no"
}

/** Master switch — Datamoon never runs unless this is true. Defaults off. */
export function isDatamoonProviderEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return parseTruthy(env.DATAMOON_PROVIDER_ENABLED)
}

/** When true (default), no live HTTP calls are made. Set DATAMOON_DRY_RUN_ONLY=false for live. */
export function isDatamoonDryRunOnly(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.DATAMOON_DRY_RUN_ONLY
  if (raw === undefined || raw.trim() === "") return true
  if (parseExplicitFalse(raw)) return false
  if (parseTruthy(raw)) return true
  return true
}

export function getDatamoonEnrichmentApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.DATAMOON_ENRICHMENT_API_KEY?.trim() || null
}

export function getDatamoonAudienceExtApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.DATAMOON_AUDIENCE_EXT_API_KEY?.trim() || null
}

export function getDatamoonAudienceModuleApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.DATAMOON_AUDIENCE_MODULE_API_KEY?.trim() || null
}

export function resolveDatamoonAudienceMode(env: NodeJS.ProcessEnv = process.env): DatamoonAudienceMode {
  const raw = env.DATAMOON_DEFAULT_MODE?.trim().toLowerCase()
  return raw === "module" ? "module" : "ext"
}

export function resolveDatamoonAudienceBaseUrl(
  mode: DatamoonAudienceMode = resolveDatamoonAudienceMode(),
): string {
  return mode === "module" ? DATAMOON_AUDIENCE_MODULE_BASE_URL : DATAMOON_AUDIENCE_EXT_BASE_URL
}

export function getDatamoonAudienceApiKey(
  env: NodeJS.ProcessEnv = process.env,
  mode: DatamoonAudienceMode = resolveDatamoonAudienceMode(env),
): string | null {
  return mode === "module" ? getDatamoonAudienceModuleApiKey(env) : getDatamoonAudienceExtApiKey(env)
}

export function isDatamoonEnrichmentConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(getDatamoonEnrichmentApiKey(env))
}

export function isDatamoonAudienceConfigured(
  env: NodeJS.ProcessEnv = process.env,
  mode: DatamoonAudienceMode = resolveDatamoonAudienceMode(env),
): boolean {
  return Boolean(getDatamoonAudienceApiKey(env, mode))
}

export function resolveDatamoonAvailableCapabilities(
  env: NodeJS.ProcessEnv = process.env,
): DatamoonProviderCapability[] {
  const capabilities: DatamoonProviderCapability[] = []
  if (isDatamoonAudienceConfigured(env)) {
    capabilities.push("audience_build", "audience_poll")
  }
  if (isDatamoonEnrichmentConfigured(env)) {
    capabilities.push("enrichment_email", "enrichment_phone")
  }
  return capabilities
}

/** Provider is configured when enabled and either dry-run or at least one capability has keys. */
export function isDatamoonProviderConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isDatamoonProviderEnabled(env)) return false
  if (isDatamoonDryRunOnly(env)) return true
  return resolveDatamoonAvailableCapabilities(env).length > 0
}
