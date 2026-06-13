/** Apollo enrichment recovery batch route gates — client-safe, no secrets. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import {
  diagnoseApolloContactDiscoveryConfig,
  type ApolloConfigDiagnostics,
} from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import {
  isApolloEmailEnrichmentEnabled,
  isApolloMockEnabled,
  isApolloProviderConfigured,
} from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_ENRICHMENT_RECOVERY_ROUTE_QA_MARKER =
  "apollo-enrichment-recovery-route-v14-3g" as const

export const APOLLO_ENRICHMENT_RECOVERY_EXECUTE_CONFIRM =
  "RUN_APOLLO_32_COMPANY_EMAIL_RECOVERY" as const

export const APOLLO_ENRICHMENT_RECOVERY_DEFAULT_LIMIT = 32 as const
export const APOLLO_ENRICHMENT_RECOVERY_MAX_LIMIT = 32 as const

export type ApolloEnrichmentRecoveryExecuteInput = {
  confirm: typeof APOLLO_ENRICHMENT_RECOVERY_EXECUTE_CONFIRM
  limit?: number
  offset?: number
  dry_run?: boolean
  company_candidate_ids?: string[]
  stop_after_recovered_companies?: number | null
}

export const APOLLO_ENRICHMENT_RECOVERY_DEFAULT_CHUNK_LIMIT = 4 as const

export function isApolloEnrichmentRecoveryProductionRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.VERCEL_ENV === "production"
}

export function assertApolloEnrichmentRecoveryExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): { ok: boolean; error: string | null; blockers: string[] } {
  const blockers: string[] = []

  if (!isApolloEnrichmentRecoveryProductionRuntime(env)) {
    blockers.push("VERCEL_ENV must be production (Vercel Production deployment only)")
  }

  if (env.GROWTH_ENGINE_ENABLED?.trim() !== "true") {
    blockers.push("GROWTH_ENGINE_ENABLED must be true")
  }

  if (env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_LIVE_BENCHMARK_ACK must be 1 for live Apollo credit usage")
  }

  if (isApolloMockEnabled(env)) {
    blockers.push("GROWTH_APOLLO_USE_MOCK must be false for live enrichment recovery")
  }

  if (!isApolloProviderConfigured(env)) {
    blockers.push("Apollo provider not configured")
  }

  if (!isApolloEmailEnrichmentEnabled(env)) {
    blockers.push("GROWTH_APOLLO_ENRICH_EMAILS must be true (search-only mode blocks bulk_match)")
  }

  if (env.GROWTH_APOLLO_ENRICH_EMAILS_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_ENRICH_EMAILS_ACK must be 1")
  }

  const config = diagnoseApolloContactDiscoveryConfig(env)
  if (!config.ready_for_live_benchmark) {
    for (const issue of config.issues) {
      if (issue.severity === "error") blockers.push(issue.message)
    }
  }

  return {
    ok: blockers.length === 0,
    error: blockers[0] ?? null,
    blockers,
  }
}

function parseNonNegativeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value))
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed)) return Math.max(0, parsed)
  }
  return null
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
}

export function validateApolloEnrichmentRecoveryConfirmation(body: unknown): {
  ok: boolean
  error: string | null
  input: ApolloEnrichmentRecoveryExecuteInput | null
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_ENRICHMENT_RECOVERY_EXECUTE_CONFIRM}".`,
      input: null,
    }
  }

  const record = body as Record<string, unknown>
  if (record.confirm !== APOLLO_ENRICHMENT_RECOVERY_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_ENRICHMENT_RECOVERY_EXECUTE_CONFIRM}".`,
      input: null,
    }
  }

  const limitRaw = parsePositiveInt(record.limit)
  const limit = limitRaw
    ? Math.min(APOLLO_ENRICHMENT_RECOVERY_MAX_LIMIT, limitRaw)
    : APOLLO_ENRICHMENT_RECOVERY_DEFAULT_LIMIT

  const offset = parseNonNegativeInt(record.offset) ?? 0

  const stopRaw = parsePositiveInt(record.stop_after_recovered_companies)
  const stop_after_recovered_companies =
    record.stop_after_recovered_companies === null
      ? null
      : stopRaw ?? null

  return {
    ok: true,
    error: null,
    input: {
      confirm: APOLLO_ENRICHMENT_RECOVERY_EXECUTE_CONFIRM,
      limit,
      offset,
      dry_run: record.dry_run === true,
      company_candidate_ids: parseStringArray(record.company_candidate_ids),
      stop_after_recovered_companies,
    },
  }
}

export function buildApolloEnrichmentRecoveryReadinessPayload(input?: {
  env?: NodeJS.ProcessEnv
  nowIso?: string
}) {
  const env = input?.env ?? process.env
  const gates = assertApolloEnrichmentRecoveryExecuteAllowed(env)

  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: APOLLO_ENRICHMENT_RECOVERY_ROUTE_QA_MARKER,
    checked_at: input?.nowIso ?? new Date().toISOString(),
    ready: gates.ok,
    production_runtime: isApolloEnrichmentRecoveryProductionRuntime(env),
    enrich_emails_enabled: isApolloEmailEnrichmentEnabled(env),
    enrich_emails_ack: env.GROWTH_APOLLO_ENRICH_EMAILS_ACK === "1",
    apollo_api_key_present: isApolloProviderConfigured(env),
    ready_for_enrichment: gates.ok,
    default_limit: APOLLO_ENRICHMENT_RECOVERY_DEFAULT_LIMIT,
    max_limit: APOLLO_ENRICHMENT_RECOVERY_MAX_LIMIT,
    blockers: gates.blockers,
    config_diagnostics: diagnoseApolloContactDiscoveryConfig(env) as ApolloConfigDiagnostics,
    runtime: {
      node_env: env.NODE_ENV ?? null,
      vercel_env: env.VERCEL_ENV ?? null,
    },
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloEnrichmentRecoverySecrets }
