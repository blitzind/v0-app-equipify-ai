/** Apollo production yield benchmark route gates — client-safe, no secrets. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import {
  resolveApolloProductionYieldBenchmarkCompanyLimit,
} from "@/lib/growth/apollo/apollo-production-yield-benchmark-cohort-selection"
import {
  APOLLO_PRODUCTION_YIELD_BENCHMARK_DEFAULT_COMPANY_LIMIT,
  APOLLO_PRODUCTION_YIELD_BENCHMARK_MAX_COMPANY_LIMIT,
} from "@/lib/growth/apollo/apollo-production-yield-benchmark-types"
import {
  assertApolloScale2ProductionExecuteAllowed,
  buildApolloScale2ProductionReadinessPayload,
  isApolloScale2ProductionRuntime,
} from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"
import { buildApolloSearchApiBudgetEvidence } from "@/lib/growth/apollo/apollo-search-api-budget-evidence"
import { diagnoseApolloContactDiscoveryConfig } from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import { resolveApolloCreditLimits } from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_PRODUCTION_YIELD_BENCHMARK_ROUTE_QA_MARKER =
  "apollo-production-yield-benchmark-route-v1" as const

export const APOLLO_PRODUCTION_YIELD_BENCHMARK_EXECUTE_CONFIRM =
  "RUN_APOLLO_PRODUCTION_YIELD_BENCHMARK" as const

export const APOLLO_PRODUCTION_YIELD_BENCHMARK_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo production yield benchmark — greenfield 50-company run (Vercel Production)
await fetch("/api/platform/growth/apollo-production-yield-benchmark/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("apollo-yield-benchmark readiness", payload))

await fetch("/api/platform/growth/apollo-production-yield-benchmark/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ confirm: "${APOLLO_PRODUCTION_YIELD_BENCHMARK_EXECUTE_CONFIRM}" }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("benchmark_id", payload.benchmark?.benchmark_id)
    console.log("execution_id", payload.execution_id)
    console.log("aggregate", payload.benchmark?.aggregate)
    console.log("economics", payload.benchmark?.economics)
    console.log("top_blockers", payload.benchmark?.top_blockers)
    console.log("recommendation", payload.benchmark?.recommendation)
    console.log("companies", payload.benchmark?.companies)
    return payload
  })`

export function isApolloProductionYieldBenchmarkEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_APOLLO_PRODUCTION_YIELD_BENCHMARK_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function assertApolloProductionYieldBenchmarkExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
  input?: { company_limit?: number },
): ReturnType<typeof assertApolloScale2ProductionExecuteAllowed> {
  const blockers: string[] = []
  const company_limit = resolveApolloProductionYieldBenchmarkCompanyLimit({
    company_limit: input?.company_limit,
    env,
  })

  const base = assertApolloScale2ProductionExecuteAllowed({
    ...env,
    GROWTH_APOLLO_SCALE_2_ENABLED:
      env.GROWTH_APOLLO_PRODUCTION_YIELD_BENCHMARK_ENABLED ??
      env.GROWTH_APOLLO_SCALE_2_ENABLED,
    GROWTH_APOLLO_SCALE_2_ACK:
      env.GROWTH_APOLLO_PRODUCTION_YIELD_BENCHMARK_ACK ?? env.GROWTH_APOLLO_SCALE_2_ACK,
  } as NodeJS.ProcessEnv)

  if (!isApolloProductionYieldBenchmarkEnabled(env)) {
    blockers.push("GROWTH_APOLLO_PRODUCTION_YIELD_BENCHMARK_ENABLED must be true")
  }
  if (env.GROWTH_APOLLO_PRODUCTION_YIELD_BENCHMARK_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_PRODUCTION_YIELD_BENCHMARK_ACK must be 1")
  }

  const limits = resolveApolloCreditLimits(env)
  if (limits.max_companies_per_run < company_limit) {
    blockers.push(
      `GROWTH_APOLLO_MAX_COMPANIES_PER_RUN (${limits.max_companies_per_run}) must be >= ${company_limit}`,
    )
  }
  const minApiCalls = company_limit * 3
  if (limits.max_api_calls_per_run < minApiCalls) {
    blockers.push(
      `GROWTH_APOLLO_MAX_API_CALLS_PER_RUN (${limits.max_api_calls_per_run}) should be >= ${minApiCalls} for ${company_limit}-company yield benchmark`,
    )
  }

  return {
    ...base,
    ok: base.ok && blockers.length === 0,
    blockers: [
      ...blockers,
      ...base.blockers.filter((b) => !b.includes("GROWTH_APOLLO_SCALE_2")),
    ],
    error: blockers[0] ?? base.error,
    company_limit,
  }
}

export function validateApolloProductionYieldBenchmarkConfirmation(body: unknown): {
  ok: boolean
  error: string | null
  company_limit: number
  contact_limit?: number
} {
  const company_limit = resolveApolloProductionYieldBenchmarkCompanyLimit()

  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_PRODUCTION_YIELD_BENCHMARK_EXECUTE_CONFIRM}".`,
      company_limit,
    }
  }

  const record = body as Record<string, unknown>
  if (record.confirm !== APOLLO_PRODUCTION_YIELD_BENCHMARK_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_PRODUCTION_YIELD_BENCHMARK_EXECUTE_CONFIRM}".`,
      company_limit,
    }
  }

  if (
    record.cohort_preset === "certification_winners" ||
    record.certification_mode === "certification_winners_revalidation"
  ) {
    return {
      ok: false,
      error: "Production yield benchmark is greenfield-only — historical revalidation is not allowed.",
      company_limit,
    }
  }

  const limitRaw =
    typeof record.companyLimit === "number"
      ? record.companyLimit
      : typeof record.companyLimit === "string"
        ? Number.parseInt(record.companyLimit, 10)
        : typeof record.company_limit === "number"
          ? record.company_limit
          : typeof record.company_limit === "string"
            ? Number.parseInt(record.company_limit, 10)
            : undefined

  const resolvedCompanyLimit =
    limitRaw && Number.isFinite(limitRaw) && limitRaw > 50
      ? APOLLO_PRODUCTION_YIELD_BENCHMARK_MAX_COMPANY_LIMIT
      : APOLLO_PRODUCTION_YIELD_BENCHMARK_DEFAULT_COMPANY_LIMIT

  const contactRaw =
    typeof record.contactLimit === "number"
      ? record.contactLimit
      : typeof record.contactLimit === "string"
        ? Number.parseInt(record.contactLimit, 10)
        : undefined

  return {
    ok: true,
    error: null,
    company_limit: resolvedCompanyLimit,
    ...(contactRaw && Number.isFinite(contactRaw) && contactRaw > 0
      ? { contact_limit: Math.min(contactRaw, 25) }
      : {}),
  }
}

export function buildApolloProductionYieldBenchmarkReadinessPayload(input: {
  cohort_companies_selected: number
  cohort_companies: Array<{
    company_candidate_id: string
    company_name: string
    domain: string | null
    domain_present: boolean
  }>
  cohort_error: string | null
  env?: NodeJS.ProcessEnv
  nowIso?: string
}) {
  const env = input.env ?? process.env
  const company_limit = resolveApolloProductionYieldBenchmarkCompanyLimit({ env })
  const gates = assertApolloProductionYieldBenchmarkExecuteAllowed(env, { company_limit })
  const base = buildApolloScale2ProductionReadinessPayload({
    ...input,
    cohort_companies: input.cohort_companies.map((row) => ({
      company_candidate_id: row.company_candidate_id,
      company_name: row.company_name,
      domain: row.domain ?? "",
    })),
    env: {
      ...env,
      GROWTH_APOLLO_SCALE_2_ENABLED:
        env.GROWTH_APOLLO_PRODUCTION_YIELD_BENCHMARK_ENABLED ?? "true",
      GROWTH_APOLLO_SCALE_2_ACK: env.GROWTH_APOLLO_PRODUCTION_YIELD_BENCHMARK_ACK ?? "1",
    } as NodeJS.ProcessEnv,
  })

  const blockers = [...gates.blockers]
  if (input.cohort_error) {
    blockers.push(input.cohort_error)
  } else if (input.cohort_companies_selected < company_limit) {
    blockers.push(
      `Yield benchmark requires ${company_limit} greenfield companies; only ${input.cohort_companies_selected} eligible.`,
    )
  }

  return redactApolloEnrichmentCertProductionSecrets({
    ...base,
    qa_marker: APOLLO_PRODUCTION_YIELD_BENCHMARK_ROUTE_QA_MARKER,
    ready: gates.ok && !input.cohort_error && input.cohort_companies_selected >= company_limit,
    production_yield_benchmark_enabled: isApolloProductionYieldBenchmarkEnabled(env),
    production_runtime: isApolloScale2ProductionRuntime(env),
    company_limit,
    default_company_limit: APOLLO_PRODUCTION_YIELD_BENCHMARK_DEFAULT_COMPANY_LIMIT,
    max_company_limit: APOLLO_PRODUCTION_YIELD_BENCHMARK_MAX_COMPANY_LIMIT,
    certification_mode: "greenfield",
    historical_revalidation_allowed: false,
    blockers,
    config_diagnostics: diagnoseApolloContactDiscoveryConfig(env),
    browser_console_execute_snippet: APOLLO_PRODUCTION_YIELD_BENCHMARK_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    search_api_budget: buildApolloSearchApiBudgetEvidence({ env, company_limit }),
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloProductionYieldBenchmarkSecrets }
