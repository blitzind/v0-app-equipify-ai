/** Apollo contact discovery provider configuration — client-safe env resolution. */

export const GROWTH_APOLLO_PROVIDER_QA_MARKER = "growth-apollo-provider-7-pca-2-v1" as const

export function getApolloApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return (
    env.APOLLO_API_KEY?.trim() ||
    env.GROWTH_APOLLO_API_KEY?.trim() ||
    null
  )
}

export function isApolloApiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(getApolloApiKey(env))
}

/** Master switch — Apollo is never in operator chain unless this is true. */
export function isApolloContactDiscoveryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function isApolloDiscoveryDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GROWTH_DISCOVERY_DISABLE_APOLLO === "1"
}

/** Mock/fixture mode — no HTTP calls, no credits consumed. */
export function isApolloMockEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_APOLLO_USE_MOCK?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

/** When true, live mode may call people/bulk_match to retrieve emails (consumes credits). */
export function isApolloEmailEnrichmentEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_APOLLO_ENRICH_EMAILS?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function isApolloProviderConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isApolloDiscoveryDisabled(env)) return false
  if (!isApolloContactDiscoveryEnabled(env)) return false
  return isApolloApiConfigured() || isApolloMockEnabled(env)
}

export function resolveApolloApiBaseUrl(): string {
  return "https://api.apollo.io/api/v1"
}

export const APOLLO_DEFAULT_PEOPLE_SEARCH_PATH = "/mixed_people/api_search" as const
export const APOLLO_BULK_MATCH_PATH = "/people/bulk_match" as const

export const APOLLO_DEFAULT_PER_COMPANY_LIMIT = 20 as const
export const APOLLO_MAX_PER_COMPANY_LIMIT = 25 as const
export const APOLLO_BULK_MATCH_BATCH_SIZE = 10 as const

export const APOLLO_DEFAULT_MAX_COMPANIES_PER_RUN = 54 as const
export const APOLLO_DEFAULT_MAX_API_CALLS_PER_RUN = 60 as const
export const APOLLO_DEFAULT_MAX_CONTACTS_PER_COMPANY = 25 as const

export type ApolloCreditLimits = {
  max_companies_per_run: number
  max_api_calls_per_run: number
  max_enrichment_batches_per_run: number
  max_contacts_per_company: number
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

export function resolveApolloCreditLimits(env: NodeJS.ProcessEnv = process.env): ApolloCreditLimits {
  const max_api_calls_per_run = parsePositiveInt(
    env.GROWTH_APOLLO_MAX_API_CALLS_PER_RUN,
    APOLLO_DEFAULT_MAX_API_CALLS_PER_RUN,
  )
  return {
    max_companies_per_run: parsePositiveInt(
      env.GROWTH_APOLLO_MAX_COMPANIES_PER_RUN,
      APOLLO_DEFAULT_MAX_COMPANIES_PER_RUN,
    ),
    max_api_calls_per_run,
    max_enrichment_batches_per_run: parsePositiveInt(
      env.GROWTH_APOLLO_MAX_ENRICHMENT_BATCHES_PER_RUN,
      max_api_calls_per_run,
    ),
    max_contacts_per_company: parsePositiveInt(
      env.GROWTH_APOLLO_MAX_CONTACTS_PER_COMPANY,
      APOLLO_DEFAULT_MAX_CONTACTS_PER_COMPANY,
    ),
  }
}
