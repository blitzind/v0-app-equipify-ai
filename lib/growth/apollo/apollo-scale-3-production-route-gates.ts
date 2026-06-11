/** Apollo-Scale-3 production route gates — client-safe, no secrets. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import { APOLLO_SCALE_3_CERTIFICATION_WINNER_COMPANY_NAMES } from "@/lib/growth/apollo/apollo-scale-3-certification-cohort-selection"
import { buildApolloSearchApiBudgetEvidence } from "@/lib/growth/apollo/apollo-search-api-budget-evidence"
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

export { APOLLO_SCALE_3_CERTIFICATION_WINNER_COMPANY_NAMES }

export const APOLLO_SCALE_3_FORCED_COHORT_EXECUTE_SNIPPET = `await fetch("/api/platform/growth/apollo-scale-3/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    confirm: "${APOLLO_SCALE_3_EXECUTE_CONFIRM}",
    cohort_preset: "certification_winners",
  }),
})`

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
    console.log("cohort_selection", payload.cohort_selection)
    console.log("fail_reasons", payload.fail_reasons)
    console.log("warnings", payload.warnings)
    console.log("partial_company_fail_reasons", payload.partial_company_fail_reasons)
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
        current_run_apollo_verified_email_contacts: row.current_run_apollo_verified_email_contacts,
        current_run_apollo_promoted_contacts: row.current_run_apollo_promoted_contacts,
        current_run_apollo_contactable_contacts: row.current_run_apollo_contactable_contacts,
        current_run_apollo_sequence_ready_contacts: row.current_run_apollo_sequence_ready_contacts,
        certification_fail_reasons: row.certification_fail_reasons,
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
  company_names?: string[]
  company_candidate_ids?: string[]
  cohort_preset?: "certification_winners"
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

  const company_names = parseStringArray(record.company_names ?? record.companyNames)
  const company_candidate_ids = parseStringArray(
    record.company_candidate_ids ?? record.companyCandidateIds,
  )
  const cohort_preset =
    record.cohort_preset === "certification_winners" ||
    record.cohortPreset === "certification_winners"
      ? ("certification_winners" as const)
      : undefined

  if (company_names && company_candidate_ids) {
    return {
      ok: false,
      error: "Provide either company_names or company_candidate_ids, not both.",
      company_limit,
    }
  }
  if (cohort_preset && (company_names || company_candidate_ids)) {
    return {
      ok: false,
      error: "cohort_preset cannot be combined with company_names or company_candidate_ids.",
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
    ...(company_names ? { company_names } : {}),
    ...(company_candidate_ids ? { company_candidate_ids } : {}),
    ...(cohort_preset ? { cohort_preset } : {}),
    ...(limitRaw && Number.isFinite(limitRaw) && limitRaw > 0
      ? { contact_limit: Math.min(limitRaw, 25) }
      : {}),
  }
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
  return items.length > 0 ? items : undefined
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
    forced_cohort_execute_snippet: APOLLO_SCALE_3_FORCED_COHORT_EXECUTE_SNIPPET,
    certification_winner_company_names: [...APOLLO_SCALE_3_CERTIFICATION_WINNER_COMPANY_NAMES],
    cohort_selection_options: {
      default: "deterministic_default_no_prior_apollo",
      cohort_preset: "certification_winners",
      company_names: "forced_company_names",
      company_candidate_ids: "forced_company_candidate_ids",
    },
    search_api_budget: buildApolloSearchApiBudgetEvidence({ env, company_limit }),
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloScale3ProductionSecrets }
