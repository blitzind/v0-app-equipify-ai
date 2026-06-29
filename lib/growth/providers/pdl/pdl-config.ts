/** PDL provider configuration — client-safe env resolution (GE-PROVIDERS-1A). */

export const GROWTH_PDL_PROVIDER_CONFIG_QA_MARKER =
  "growth-pdl-provider-config-ge-providers-1a-v1" as const

export function getPdlApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.PEOPLE_DATA_LABS_API_KEY?.trim() || env.PDL_API_KEY?.trim() || null
}

export function isPdlApiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(getPdlApiKey(env))
}

/** Master switch — PDL is never in operator chain unless this is true (Apollo parity). */
export function isPdlContactDiscoveryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_CONTACT_DISCOVERY_PDL_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function isPdlDiscoveryDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GROWTH_DISCOVERY_DISABLE_PDL === "1"
}

/** Mock/fixture mode — no HTTP calls, no credits consumed. */
export function isPdlMockEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_PDL_USE_MOCK?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function isPdlProviderConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isPdlDiscoveryDisabled(env)) return false
  if (!isPdlContactDiscoveryEnabled(env)) return false
  return isPdlApiConfigured(env) || isPdlMockEnabled(env)
}

export type PdlSandboxEnvConfig = {
  env_raw: string | null
  env_explicit: boolean
  env_sandbox_enabled: boolean
}

/** Production-first: sandbox OFF when unset. Set PDL_USE_SANDBOX=true for no-credit testing. */
export function resolvePdlSandboxEnvConfig(
  env: NodeJS.ProcessEnv = process.env,
): PdlSandboxEnvConfig {
  const raw = env.PDL_USE_SANDBOX?.trim() ?? null
  if (!raw) {
    return { env_raw: null, env_explicit: false, env_sandbox_enabled: false }
  }
  const lower = raw.toLowerCase()
  if (lower === "0" || lower === "false" || lower === "no") {
    return { env_raw: raw, env_explicit: true, env_sandbox_enabled: false }
  }
  if (lower === "1" || lower === "true" || lower === "yes") {
    return { env_raw: raw, env_explicit: true, env_sandbox_enabled: true }
  }
  return { env_raw: raw, env_explicit: true, env_sandbox_enabled: true }
}

export function isPdlSandboxEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolvePdlSandboxEnvConfig(env).env_sandbox_enabled
}

export function resolvePdlApiBaseUrl(sandbox = isPdlSandboxEnabled()): string {
  return sandbox ? "https://sandbox.api.peopledatalabs.com/v5" : "https://api.peopledatalabs.com/v5"
}

export function resolvePdlPersonSearchBaseUrl(sandbox = isPdlSandboxEnabled()): string {
  return `${resolvePdlApiBaseUrl(sandbox)}/person/search`
}

export function resolvePdlPersonEnrichBaseUrl(sandbox = isPdlSandboxEnabled()): string {
  return `${resolvePdlApiBaseUrl(sandbox)}/person/enrich`
}

export function resolvePdlCompanyEnrichBaseUrl(sandbox = isPdlSandboxEnabled()): string {
  return `${resolvePdlApiBaseUrl(sandbox)}/company/enrich`
}

export const PDL_DEFAULT_MAX_LOOKUPS_PER_RUN = 40 as const
export const PDL_DEFAULT_MAX_COMPANIES_PER_RUN = 25 as const
export const PDL_DEFAULT_MAX_CONTACTS_PER_COMPANY = 25 as const
export const PDL_DEFAULT_MAX_DAILY_LOOKUPS = 500 as const
export const PDL_DEFAULT_REQUEST_TIMEOUT_MS = 15_000 as const
export const PDL_DEFAULT_MAX_RETRIES = 2 as const

export type PdlCreditLimits = {
  max_lookups_per_run: number
  max_companies_per_run: number
  max_contacts_per_company: number
  max_daily_lookups: number
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

export function resolvePdlCreditLimits(env: NodeJS.ProcessEnv = process.env): PdlCreditLimits {
  return {
    max_lookups_per_run: parsePositiveInt(
      env.GROWTH_PDL_MAX_LOOKUPS_PER_RUN,
      PDL_DEFAULT_MAX_LOOKUPS_PER_RUN,
    ),
    max_companies_per_run: parsePositiveInt(
      env.GROWTH_PDL_MAX_COMPANIES_PER_RUN,
      PDL_DEFAULT_MAX_COMPANIES_PER_RUN,
    ),
    max_contacts_per_company: parsePositiveInt(
      env.GROWTH_PDL_MAX_CONTACTS_PER_COMPANY,
      PDL_DEFAULT_MAX_CONTACTS_PER_COMPANY,
    ),
    max_daily_lookups: parsePositiveInt(
      env.GROWTH_PDL_MAX_DAILY_LOOKUPS,
      PDL_DEFAULT_MAX_DAILY_LOOKUPS,
    ),
  }
}

export function resolveContactsPerCompanyLimit(
  requested: number | undefined,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const limits = resolvePdlCreditLimits(env)
  const base = requested ?? limits.max_contacts_per_company
  return Math.min(Math.max(base, 1), limits.max_contacts_per_company)
}
