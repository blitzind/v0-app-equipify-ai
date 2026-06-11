/** Apollo single-company search diagnostic route gates — search-only, no enrichment. Client-safe. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import {
  diagnoseApolloContactDiscoveryConfig,
  type ApolloConfigDiagnostics,
} from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import { isApolloMockEnabled, resolveApolloCreditLimits } from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_QA_MARKER =
  "apollo-single-company-search-diagnostic-v1" as const

export const APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_EXECUTE_CONFIRM =
  "RUN_APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC" as const

/** Five tier attempts per company plus headroom for internal retries. */
export const APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_MAX_API_CALLS = 8 as const

export const APOLLO_SCALE_3_RECOMMENDED_MAX_API_CALLS_PER_RUN = 90 as const

export const APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo single-company search diagnostic — tiers A–E only (no enrichment/promotion)
await fetch("/api/platform/growth/apollo-single-company-search/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("apollo single-company search readiness", payload))

await fetch("/api/platform/growth/apollo-single-company-search/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    confirm: "${APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_EXECUTE_CONFIRM}",
    company_name: "Stat Biomedical Technicians, Inc.",
    include_domain_aliases: true,
  }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("company", payload.company)
    console.log("domain_alias_evidence", payload.domain_alias_evidence)
    console.log("per_domain_tier_attempts", payload.per_domain_tier_attempts)
    console.log("tier_attempts_compact", payload.tier_attempts_compact)
    console.log("mapper_rejection_evidence", payload.mapper_rejection_evidence)
    console.log("tier_attempts", payload.tier_attempts)
    return payload
  })`

export type ApolloSingleCompanySearchDiagnosticExecuteGateResult = {
  ok: boolean
  error: string | null
  blockers: string[]
}

export function isApolloSingleCompanySearchDiagnosticProductionRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.VERCEL_ENV === "production"
}

export function assertApolloSingleCompanySearchDiagnosticExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ApolloSingleCompanySearchDiagnosticExecuteGateResult {
  const blockers: string[] = []

  if (!isApolloSingleCompanySearchDiagnosticProductionRuntime(env)) {
    blockers.push("VERCEL_ENV must be production (Vercel Production deployment only)")
  }

  if (env.GROWTH_APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_ACK must be 1")
  }

  if (env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_LIVE_BENCHMARK_ACK must be 1 for live Apollo credit usage")
  }

  if (isApolloMockEnabled(env)) {
    blockers.push("GROWTH_APOLLO_USE_MOCK must be false for live single-company search diagnostic")
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

export function validateApolloSingleCompanySearchDiagnosticConfirmation(body: unknown): {
  ok: boolean
  error: string | null
  company_candidate_id: string | null
  company_name: string | null
  include_domain_aliases: boolean
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_EXECUTE_CONFIRM}" and company_candidate_id or company_name.`,
      company_candidate_id: null,
      company_name: null,
      include_domain_aliases: false,
    }
  }
  const record = body as Record<string, unknown>
  if (record.confirm !== APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_EXECUTE_CONFIRM}".`,
      company_candidate_id: null,
      company_name: null,
      include_domain_aliases: false,
    }
  }

  const company_candidate_id =
    typeof record.company_candidate_id === "string" ? record.company_candidate_id.trim() : ""
  const company_name = typeof record.company_name === "string" ? record.company_name.trim() : ""
  const include_domain_aliases = record.include_domain_aliases === true

  if (!company_candidate_id && !company_name) {
    return {
      ok: false,
      error: "Provide company_candidate_id or company_name.",
      company_candidate_id: null,
      company_name: null,
      include_domain_aliases: false,
    }
  }

  return {
    ok: true,
    error: null,
    company_candidate_id: company_candidate_id || null,
    company_name: company_name || null,
    include_domain_aliases,
  }
}

export type ApolloSingleCompanySearchDiagnosticReadinessPayload = {
  qa_marker: typeof APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_QA_MARKER
  checked_at: string
  ready: boolean
  production_runtime: boolean
  apollo_credits_required: true
  max_api_calls_this_run: number
  recommended_scale_3_max_api_calls_per_run: number
  blockers: string[]
  config_diagnostics: ApolloConfigDiagnostics
  browser_console_execute_snippet: typeof APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_BROWSER_CONSOLE_EXECUTE_SNIPPET
  runtime: {
    node_env: string | null
    vercel_env: string | null
  }
}

export function buildApolloSingleCompanySearchDiagnosticReadinessPayload(input?: {
  env?: NodeJS.ProcessEnv
  nowIso?: string
}): ApolloSingleCompanySearchDiagnosticReadinessPayload {
  const env = input?.env ?? process.env
  const gates = assertApolloSingleCompanySearchDiagnosticExecuteAllowed(env)
  const limits = resolveApolloCreditLimits(env)
  const blockers = [...gates.blockers]

  if (limits.max_api_calls_per_run < APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_MAX_API_CALLS) {
    blockers.push(
      `GROWTH_APOLLO_MAX_API_CALLS_PER_RUN (${limits.max_api_calls_per_run}) is low for single-company tier A–E diagnostic (recommend >= ${APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_MAX_API_CALLS})`,
    )
  }

  const config_diagnostics = diagnoseApolloContactDiscoveryConfig(env)

  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_QA_MARKER,
    checked_at: input?.nowIso ?? new Date().toISOString(),
    ready: gates.ok && blockers.length === gates.blockers.length,
    production_runtime: isApolloSingleCompanySearchDiagnosticProductionRuntime(env),
    apollo_credits_required: true,
    max_api_calls_this_run: APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_MAX_API_CALLS,
    recommended_scale_3_max_api_calls_per_run: APOLLO_SCALE_3_RECOMMENDED_MAX_API_CALLS_PER_RUN,
    blockers,
    config_diagnostics,
    browser_console_execute_snippet: APOLLO_SINGLE_COMPANY_SEARCH_DIAGNOSTIC_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    runtime: {
      node_env: env.NODE_ENV ?? null,
      vercel_env: env.VERCEL_ENV ?? null,
    },
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloSingleCompanySearchDiagnosticSecrets }
