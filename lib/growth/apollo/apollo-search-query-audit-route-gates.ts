/** Apollo search query audit production route gates — evidence-only, no Scale-4 product. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import {
  diagnoseApolloContactDiscoveryConfig,
  type ApolloConfigDiagnostics,
} from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import { isApolloMockEnabled } from "@/lib/growth/providers/apollo/apollo-config"
import { APOLLO_SEARCH_QUERY_AUDIT_COMPANY_NAMES } from "@/lib/growth/apollo/apollo-search-query-audit"

export const APOLLO_SEARCH_QUERY_AUDIT_ROUTE_QA_MARKER =
  "apollo-search-query-audit-route-v1" as const

export const APOLLO_SEARCH_QUERY_AUDIT_EXECUTE_CONFIRM = "RUN_APOLLO_SEARCH_QUERY_AUDIT" as const

export const APOLLO_SEARCH_QUERY_AUDIT_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo search query audit — Tier 1/2/3 evidence on Vercel Production
await fetch("/api/platform/growth/apollo-search-query-audit/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("apollo search query audit readiness", payload))

await fetch("/api/platform/growth/apollo-search-query-audit/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ confirm: "${APOLLO_SEARCH_QUERY_AUDIT_EXECUTE_CONFIRM}" }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("summary", payload.summary)
    console.log("companies", payload.companies)
    return payload
  })`

export type ApolloSearchQueryAuditExecuteGateResult = {
  ok: boolean
  error: string | null
  blockers: string[]
}

export function isApolloSearchQueryAuditProductionRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.VERCEL_ENV === "production"
}

export function assertApolloSearchQueryAuditExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ApolloSearchQueryAuditExecuteGateResult {
  const blockers: string[] = []

  if (!isApolloSearchQueryAuditProductionRuntime(env)) {
    blockers.push("VERCEL_ENV must be production (Vercel Production deployment only)")
  }

  if (env.GROWTH_APOLLO_SEARCH_QUERY_AUDIT_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_SEARCH_QUERY_AUDIT_ACK must be 1")
  }

  if (env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_LIVE_BENCHMARK_ACK must be 1 for live Apollo credit usage")
  }

  if (isApolloMockEnabled(env)) {
    blockers.push("GROWTH_APOLLO_USE_MOCK must be false for live Apollo search query audit")
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

export function validateApolloSearchQueryAuditConfirmation(body: unknown): {
  ok: boolean
  error: string | null
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_SEARCH_QUERY_AUDIT_EXECUTE_CONFIRM}".`,
    }
  }
  const record = body as Record<string, unknown>
  if (record.confirm !== APOLLO_SEARCH_QUERY_AUDIT_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_SEARCH_QUERY_AUDIT_EXECUTE_CONFIRM}".`,
    }
  }
  return { ok: true, error: null }
}

export type ApolloSearchQueryAuditReadinessPayload = {
  qa_marker: typeof APOLLO_SEARCH_QUERY_AUDIT_ROUTE_QA_MARKER
  checked_at: string
  ready: boolean
  production_runtime: boolean
  target_companies: readonly string[]
  apollo_credits_required: true
  blockers: string[]
  config_diagnostics: ApolloConfigDiagnostics
  browser_console_execute_snippet: typeof APOLLO_SEARCH_QUERY_AUDIT_BROWSER_CONSOLE_EXECUTE_SNIPPET
  runtime: {
    node_env: string | null
    vercel_env: string | null
  }
}

export function buildApolloSearchQueryAuditReadinessPayload(input?: {
  cohort_error?: string | null
  resolved_companies?: Array<{ company_name: string; domain: string }>
  env?: NodeJS.ProcessEnv
  nowIso?: string
}): ApolloSearchQueryAuditReadinessPayload {
  const env = input?.env ?? process.env
  const gates = assertApolloSearchQueryAuditExecuteAllowed(env)
  const blockers = [...gates.blockers]

  if (input?.cohort_error) blockers.push(input.cohort_error)

  const resolved = input?.resolved_companies ?? []
  for (const target of APOLLO_SEARCH_QUERY_AUDIT_COMPANY_NAMES) {
    const match = resolved.find((row) =>
      row.company_name.toLowerCase().includes(target.toLowerCase().slice(0, 12)),
    )
    if (!match?.domain) {
      blockers.push(`Missing domain for audit target: ${target}`)
    }
  }

  const config_diagnostics = diagnoseApolloContactDiscoveryConfig(env)

  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: APOLLO_SEARCH_QUERY_AUDIT_ROUTE_QA_MARKER,
    checked_at: input?.nowIso ?? new Date().toISOString(),
    ready: gates.ok && !input?.cohort_error && blockers.length === gates.blockers.length,
    production_runtime: isApolloSearchQueryAuditProductionRuntime(env),
    target_companies: APOLLO_SEARCH_QUERY_AUDIT_COMPANY_NAMES,
    apollo_credits_required: true,
    blockers,
    config_diagnostics,
    browser_console_execute_snippet: APOLLO_SEARCH_QUERY_AUDIT_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    runtime: {
      node_env: env.NODE_ENV ?? null,
      vercel_env: env.VERCEL_ENV ?? null,
    },
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloSearchQueryAuditSecrets }
