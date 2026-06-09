/** Apollo-Scale-3 production route gates — client-safe, no secrets. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import {
  assertApolloScale2ProductionExecuteAllowed,
  buildApolloScale2ProductionReadinessPayload,
  isApolloScale2Enabled,
  isApolloScale2ProductionRuntime,
  resolveApolloScale2CompanyLimit,
} from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"

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
  .then((r) => r.json())
  .then((payload) => {
    console.log("verdict", payload.verdict)
    console.log("companies", payload.companies)
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
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloScale3ProductionSecrets }
