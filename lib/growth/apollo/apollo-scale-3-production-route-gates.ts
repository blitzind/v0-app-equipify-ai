/** Apollo-Scale-3 production route gates — client-safe, no secrets. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import {
  APOLLO_SCALE_3_RECOMMENDED_MAX_API_CALLS_PER_RUN,
} from "@/lib/growth/apollo/apollo-single-company-search-diagnostic-gates"
import {
  assertApolloScale2ProductionExecuteAllowed,
  buildApolloScale2ProductionReadinessPayload,
  isApolloScale2Enabled,
  isApolloScale2ProductionRuntime,
  resolveApolloScale2CompanyLimit,
} from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"
import { resolveApolloCreditLimits } from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_SCALE_3_PRODUCTION_ROUTE_QA_MARKER =
  "apollo-scale-3-production-route-v1" as const

export const APOLLO_SCALE_3_EXECUTE_CONFIRM = "RUN_APOLLO_SCALE_3" as const

export const APOLLO_SCALE_3_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo-Scale-3 — tiered search strategy cert on Vercel Production
await fetch("/api/platform/growth/apollo-scale-3/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("apollo-scale-3 readiness", payload))

await fetch("/api/platform/growth/apollo-scale-3/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ confirm: "${APOLLO_SCALE_3_EXECUTE_CONFIRM}" }),
})
  .then(async (r) => {
    const text = await r.text()
    try {
      return JSON.parse(text)
    } catch (error) {
      console.error("apollo-scale-3 execute returned non-JSON", r.status, text.slice(0, 500))
      throw error
    }
  })
  .then((payload) => {
    console.log("ok", payload.ok)
    console.log("stage", payload.stage)
    console.log("error", payload.error ?? null, payload.message ?? null)
    console.log("verdict", payload.verdict)
    console.log("aggregate", payload.aggregate)
    console.log("failure_analysis", payload.failure_analysis)
    console.log("search_outcomes", (payload.companies ?? []).reduce((acc, row) => {
      const outcome = row.acquisition_evidence?.search_outcome ?? "unknown"
      acc[outcome] = (acc[outcome] ?? 0) + 1
      return acc
    }, {}))
    for (const row of payload.companies ?? []) {
      console.log("company", row.company_name, {
        search_outcome: row.acquisition_evidence?.search_outcome,
        raw: row.raw_contacts_returned,
        mapped: row.mapped_contacts,
        tier_attempts_compact: row.tier_attempts_compact,
        mapper_rejection_evidence: row.mapper_rejection_evidence,
        rejection_reasons: row.rejection_reasons,
      })
    }
    return payload
  })`

export function isApolloScale3Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_APOLLO_SCALE_3_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function assertApolloScale3ProductionExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ReturnType<typeof assertApolloScale2ProductionExecuteAllowed> {
  const blockers: string[] = []
  const base = assertApolloScale2ProductionExecuteAllowed({
    ...env,
    GROWTH_APOLLO_SCALE_2_ENABLED: env.GROWTH_APOLLO_SCALE_3_ENABLED ?? env.GROWTH_APOLLO_SCALE_2_ENABLED,
    GROWTH_APOLLO_SCALE_2_ACK: env.GROWTH_APOLLO_SCALE_3_ACK ?? env.GROWTH_APOLLO_SCALE_2_ACK,
  } as NodeJS.ProcessEnv)

  if (!isApolloScale3Enabled(env)) {
    blockers.push("GROWTH_APOLLO_SCALE_3_ENABLED must be true")
  }
  if (env.GROWTH_APOLLO_SCALE_3_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_SCALE_3_ACK must be 1")
  }

  return {
    ...base,
    ok: base.ok && blockers.length === 0,
    blockers: [...blockers, ...base.blockers.filter((b) => !b.includes("GROWTH_APOLLO_SCALE_2"))],
    error: blockers[0] ?? base.error,
  }
}

export function validateApolloScale3Confirmation(body: unknown): {
  ok: boolean
  error: string | null
  company_limit: number
  contact_limit?: number
} {
  const company_limit = resolveApolloScale2CompanyLimit()
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_SCALE_3_EXECUTE_CONFIRM}".`,
      company_limit,
    }
  }
  const record = body as Record<string, unknown>
  if (record.confirm !== APOLLO_SCALE_3_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_SCALE_3_EXECUTE_CONFIRM}".`,
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

export function buildApolloScale3ProductionReadinessPayload(input: {
  cohort_companies_selected: number
  cohort_companies: Array<{ company_candidate_id: string; company_name: string; domain: string }>
  cohort_error: string | null
  env?: NodeJS.ProcessEnv
  nowIso?: string
}) {
  const env = input.env ?? process.env
  const gates = assertApolloScale3ProductionExecuteAllowed(env)
  const company_limit = resolveApolloScale2CompanyLimit()
  const limits = resolveApolloCreditLimits(env)
  const minimum_search_api_calls = company_limit * 5
  const base = buildApolloScale2ProductionReadinessPayload({
    ...input,
    env: {
      ...env,
      GROWTH_APOLLO_SCALE_2_ENABLED: env.GROWTH_APOLLO_SCALE_3_ENABLED ?? "true",
      GROWTH_APOLLO_SCALE_2_ACK: env.GROWTH_APOLLO_SCALE_3_ACK ?? "1",
    } as NodeJS.ProcessEnv,
  })

  return redactApolloEnrichmentCertProductionSecrets({
    ...base,
    qa_marker: APOLLO_SCALE_3_PRODUCTION_ROUTE_QA_MARKER,
    ready: gates.ok && base.ready,
    scale_3_enabled: isApolloScale3Enabled(env),
    production_runtime: isApolloScale2ProductionRuntime(env),
    blockers: gates.blockers.length > 0 ? gates.blockers : base.blockers,
    browser_console_execute_snippet: APOLLO_SCALE_3_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    search_api_budget: {
      current_max_api_calls_per_run: limits.max_api_calls_per_run,
      minimum_for_full_cohort_tiers: minimum_search_api_calls,
      recommended_for_cert: APOLLO_SCALE_3_RECOMMENDED_MAX_API_CALLS_PER_RUN,
      sufficient_for_full_cohort: limits.max_api_calls_per_run >= minimum_search_api_calls,
      recommended_env: `GROWTH_APOLLO_MAX_API_CALLS_PER_RUN=${APOLLO_SCALE_3_RECOMMENDED_MAX_API_CALLS_PER_RUN}`,
    },
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloScale3ProductionSecrets }
