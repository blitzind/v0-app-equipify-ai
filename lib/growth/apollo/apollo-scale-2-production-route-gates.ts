/** Apollo-Scale-2 production route gates — client-safe, no secrets. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import {
  diagnoseApolloContactDiscoveryConfig,
  type ApolloConfigDiagnostics,
} from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import { isApolloMockEnabled } from "@/lib/growth/providers/apollo/apollo-config"
import { resolveApolloCreditLimits } from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_SCALE_2_PRODUCTION_ROUTE_QA_MARKER =
  "apollo-scale-2-production-route-v1" as const

export const APOLLO_SCALE_2_EXECUTE_CONFIRM = "RUN_APOLLO_SCALE_2" as const

export const APOLLO_SCALE_2_DEFAULT_COMPANY_LIMIT = 15 as const

export const APOLLO_SCALE_2_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo-Scale-2 — run from Platform admin browser session on Vercel Production
await fetch("/api/platform/growth/apollo-scale-2/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => {
    console.log("apollo-scale-2 readiness", payload)
    return payload
  })

await fetch("/api/platform/growth/apollo-scale-2/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ confirm: "${APOLLO_SCALE_2_EXECUTE_CONFIRM}" }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("apollo-scale-2 execute", payload)
    return payload
  })`

export type ApolloScale2ProductionExecuteGateResult = {
  ok: boolean
  error: string | null
  blockers: string[]
  company_limit: number
}

export function isApolloScale2Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_APOLLO_SCALE_2_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function isApolloScale2ProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV === "production"
}

export function resolveApolloScale2CompanyLimit(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number.parseInt(env.GROWTH_APOLLO_SCALE_2_COMPANY_LIMIT ?? "15", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return APOLLO_SCALE_2_DEFAULT_COMPANY_LIMIT
  return Math.max(15, Math.min(20, parsed))
}

export function assertApolloScale2ProductionExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ApolloScale2ProductionExecuteGateResult {
  const blockers: string[] = []
  const company_limit = resolveApolloScale2CompanyLimit(env)

  if (!isApolloScale2ProductionRuntime(env)) {
    blockers.push("VERCEL_ENV must be production (Vercel Production deployment only)")
  }

  if (!isApolloScale2Enabled(env)) {
    blockers.push("GROWTH_APOLLO_SCALE_2_ENABLED must be true")
  }

  if (env.GROWTH_APOLLO_SCALE_2_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_SCALE_2_ACK must be 1")
  }

  if (env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_LIVE_BENCHMARK_ACK must be 1 for live Apollo credit usage")
  }

  if (env.GROWTH_APOLLO_ENRICH_EMAILS_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_ENRICH_EMAILS_ACK must be 1 for enrichment in Scale-2")
  }

  if (isApolloMockEnabled(env)) {
    blockers.push("GROWTH_APOLLO_USE_MOCK must be false for production Scale-2 certification")
  }

  const config = diagnoseApolloContactDiscoveryConfig(env)
  if (!config.ready_for_live_benchmark) {
    for (const issue of config.issues) {
      if (issue.severity === "error") blockers.push(issue.message)
    }
  }

  const limits = resolveApolloCreditLimits(env)
  if (limits.max_companies_per_run < company_limit) {
    blockers.push(
      `GROWTH_APOLLO_MAX_COMPANIES_PER_RUN (${limits.max_companies_per_run}) must be >= ${company_limit}`,
    )
  }
  if (limits.max_api_calls_per_run < company_limit * 2) {
    blockers.push(
      `GROWTH_APOLLO_MAX_API_CALLS_PER_RUN (${limits.max_api_calls_per_run}) is low for ${company_limit}-company Scale-2 run`,
    )
  }

  return {
    ok: blockers.length === 0,
    error: blockers[0] ?? null,
    blockers,
    company_limit,
  }
}

export function validateApolloScale2Confirmation(body: unknown): {
  ok: boolean
  error: string | null
  company_limit: number
  contact_limit?: number
} {
  const company_limit = resolveApolloScale2CompanyLimit()

  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_SCALE_2_EXECUTE_CONFIRM}".`,
      company_limit,
    }
  }

  const record = body as Record<string, unknown>
  if (record.confirm !== APOLLO_SCALE_2_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_SCALE_2_EXECUTE_CONFIRM}".`,
      company_limit,
    }
  }

  const limitRaw =
    typeof record.contactLimit === "number"
      ? record.contactLimit
      : typeof record.contactLimit === "string"
        ? Number.parseInt(record.contactLimit, 10)
        : undefined

  return {
    ok: true,
    error: null,
    company_limit,
    ...(limitRaw && Number.isFinite(limitRaw) && limitRaw > 0
      ? { contact_limit: Math.min(limitRaw, 25) }
      : {}),
  }
}

export type ApolloScale2ProductionReadinessPayload = {
  qa_marker: typeof APOLLO_SCALE_2_PRODUCTION_ROUTE_QA_MARKER
  checked_at: string
  ready: boolean
  production_runtime: boolean
  scale_2_enabled: boolean
  company_limit: number
  cohort_companies_selected: number
  cohort_companies: Array<{
    company_candidate_id: string
    company_name: string
    domain: string
  }>
  apollo_credits_required: true
  blockers: string[]
  config_diagnostics: ApolloConfigDiagnostics
  browser_console_execute_snippet: typeof APOLLO_SCALE_2_BROWSER_CONSOLE_EXECUTE_SNIPPET
  runtime: {
    node_env: string | null
    vercel_env: string | null
  }
}

export function buildApolloScale2ProductionReadinessPayload(input: {
  cohort_companies_selected: number
  cohort_companies: ApolloScale2ProductionReadinessPayload["cohort_companies"]
  cohort_error: string | null
  env?: NodeJS.ProcessEnv
  nowIso?: string
}): ApolloScale2ProductionReadinessPayload {
  const env = input.env ?? process.env
  const gates = assertApolloScale2ProductionExecuteAllowed(env)
  const blockers = [...gates.blockers]

  if (input.cohort_error) {
    blockers.push(input.cohort_error)
  } else if (input.cohort_companies_selected < 15) {
    blockers.push(
      `Scale-2 cohort requires 15–20 companies; only ${input.cohort_companies_selected} eligible.`,
    )
  }

  const config_diagnostics = diagnoseApolloContactDiscoveryConfig(env)

  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: APOLLO_SCALE_2_PRODUCTION_ROUTE_QA_MARKER,
    checked_at: input.nowIso ?? new Date().toISOString(),
    ready: gates.ok && !input.cohort_error && input.cohort_companies_selected >= 15,
    production_runtime: isApolloScale2ProductionRuntime(env),
    scale_2_enabled: isApolloScale2Enabled(env),
    company_limit: gates.company_limit,
    cohort_companies_selected: input.cohort_companies_selected,
    cohort_companies: input.cohort_companies,
    apollo_credits_required: true,
    blockers,
    config_diagnostics,
    browser_console_execute_snippet: APOLLO_SCALE_2_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    runtime: {
      node_env: env.NODE_ENV ?? null,
      vercel_env: env.VERCEL_ENV ?? null,
    },
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloScale2ProductionSecrets }
