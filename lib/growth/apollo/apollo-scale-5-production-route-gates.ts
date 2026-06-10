/** Apollo-Scale-5 verified-email promotion production route gates — client-safe. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import { APOLLO_MAPPING_AUDIT_MEDICAL_EQUIPMENT_SOLUTIONS } from "@/lib/growth/apollo/apollo-mapped-contact-pipeline-audit"
import {
  diagnoseApolloContactDiscoveryConfig,
  type ApolloConfigDiagnostics,
} from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import {
  isApolloApiConfigured,
  isApolloContactDiscoveryEnabled,
  isApolloDiscoveryDisabled,
  isApolloEmailEnrichmentEnabled,
  isApolloMockEnabled,
} from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_SCALE_5_PRODUCTION_ROUTE_QA_MARKER =
  "apollo-scale-5-production-route-v1" as const

export const APOLLO_SCALE_5_EXECUTE_CONFIRM = "RUN_APOLLO_SCALE_5" as const

export const APOLLO_SCALE_5_DEFAULT_CONTACT_LIMIT = 25 as const

export const APOLLO_SCALE_5_VERIFIED_CONTACT_NAMES = [
  "Tanya Powell",
  "Jonathan Branch",
  "Scott Alexander",
  "Kimberly Woolsey",
] as const

export const APOLLO_SCALE_5_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo-Scale-5 — verified Tier-2 email promotion cert on Vercel Production
await fetch("/api/platform/growth/apollo-scale-5/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("apollo-scale-5 readiness", payload))

await fetch("/api/platform/growth/apollo-scale-5/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ confirm: "${APOLLO_SCALE_5_EXECUTE_CONFIRM}" }),
})
  .then(async (r) => {
    const text = await r.text()
    try {
      return JSON.parse(text)
    } catch (error) {
      console.error("apollo-scale-5 execute returned non-JSON", r.status, text.slice(0, 500))
      throw error
    }
  })
  .then((payload) => {
    console.log("ok", payload.ok)
    console.log("stage", payload.stage)
    console.log("error", payload.error ?? null, payload.message ?? null)
    console.log("execution_id", payload.execution_id)
    console.log("verdict", payload.verdict)
    console.log("email_enrichment", payload.certification?.email_enrichment ?? null)
    console.log("email_channel_evidence", payload.certification?.email_channel_evidence ?? null)
    console.log("search", payload.certification?.search)
    console.log("promotion", payload.certification?.promotion)
    console.log("readiness", payload.certification?.readiness)
    payload.certification?.verified_contact_checks?.forEach((row) => {
      console.log(row.full_name, row.result, row.blocker ?? "")
    })
    return payload
  })`

export type ApolloScale5CertResult = "PASS" | "PASS_PARTIAL" | "FAIL"

export type ApolloScale5VerifiedContactCheck = {
  full_name: string
  result: "PASS" | "FAIL"
  blocker: string | null
}

export function computeApolloScale5CertResult(input: {
  promoted_contacts: number
  contactable_contacts: number
  sequence_ready_contacts: number
  verified_contact_checks: ApolloScale5VerifiedContactCheck[]
}): ApolloScale5CertResult {
  const criteriaMet =
    input.promoted_contacts > 0 &&
    input.contactable_contacts > 0 &&
    input.sequence_ready_contacts > 0

  const allVerifiedPass = input.verified_contact_checks.every((row) => row.result === "PASS")

  if (criteriaMet && allVerifiedPass) return "PASS"
  if (criteriaMet || allVerifiedPass || input.promoted_contacts > 0) return "PASS_PARTIAL"
  return "FAIL"
}

export type ApolloScale5ProductionExecuteGateResult = {
  ok: boolean
  error: string | null
  blockers: string[]
  contact_limit: number
}

export function isApolloScale5ProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV === "production"
}

export function resolveApolloScale5ContactLimit(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number.parseInt(env.GROWTH_APOLLO_SCALE_5_CONTACT_LIMIT ?? "25", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return APOLLO_SCALE_5_DEFAULT_CONTACT_LIMIT
  return Math.min(parsed, 25)
}

export function assertApolloScale5ProductionExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ApolloScale5ProductionExecuteGateResult {
  const blockers: string[] = []
  const contact_limit = resolveApolloScale5ContactLimit(env)

  if (!isApolloScale5ProductionRuntime(env)) {
    blockers.push("VERCEL_ENV must be production (Vercel Production deployment only)")
  }

  if (env.GROWTH_APOLLO_SCALE_5_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_SCALE_5_ACK must be 1")
  }

  if (env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_LIVE_BENCHMARK_ACK must be 1 for live Apollo credit usage")
  }

  if (env.GROWTH_APOLLO_ENRICH_EMAILS_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_ENRICH_EMAILS_ACK must be 1 for Apollo email enrichment")
  }

  if (!isApolloContactDiscoveryEnabled(env)) {
    blockers.push("GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED must be true")
  }

  if (isApolloDiscoveryDisabled(env)) {
    blockers.push("GROWTH_DISCOVERY_DISABLE_APOLLO must not be set")
  }

  if (!isApolloApiConfigured(env) && !isApolloMockEnabled(env)) {
    blockers.push("Apollo provider must be configured (APOLLO_API_KEY or mock mode)")
  }

  if (!isApolloEmailEnrichmentEnabled(env)) {
    blockers.push("GROWTH_APOLLO_ENRICH_EMAILS must be enabled for verified-email promotion cert")
  }

  if (isApolloMockEnabled(env)) {
    blockers.push("GROWTH_APOLLO_USE_MOCK must be false for production Scale-5 certification")
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
    contact_limit,
  }
}

export function validateApolloScale5Confirmation(body: unknown): {
  ok: boolean
  error: string | null
  contact_limit: number
} {
  const contact_limit = resolveApolloScale5ContactLimit()

  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_SCALE_5_EXECUTE_CONFIRM}".`,
      contact_limit,
    }
  }

  const record = body as Record<string, unknown>
  if (record.confirm !== APOLLO_SCALE_5_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_SCALE_5_EXECUTE_CONFIRM}".`,
      contact_limit,
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
    contact_limit:
      limitRaw && Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, 25)
        : contact_limit,
  }
}

export type ApolloScale5ProductionReadinessPayload = {
  qa_marker: typeof APOLLO_SCALE_5_PRODUCTION_ROUTE_QA_MARKER
  checked_at: string
  ready: boolean
  production_runtime: boolean
  target_company: typeof APOLLO_MAPPING_AUDIT_MEDICAL_EQUIPMENT_SOLUTIONS
  company_candidate_id: string | null
  contact_limit: number
  apollo_credits_required: true
  blockers: string[]
  config_diagnostics: ApolloConfigDiagnostics
  browser_console_execute_snippet: typeof APOLLO_SCALE_5_BROWSER_CONSOLE_EXECUTE_SNIPPET
  runtime: {
    node_env: string | null
    vercel_env: string | null
  }
}

export function buildApolloScale5ProductionReadinessPayload(input: {
  company_candidate_id: string | null
  company_resolution_error: string | null
  env?: NodeJS.ProcessEnv
  nowIso?: string
}): ApolloScale5ProductionReadinessPayload {
  const env = input.env ?? process.env
  const gates = assertApolloScale5ProductionExecuteAllowed(env)
  const blockers = [...gates.blockers]

  if (input.company_resolution_error) {
    blockers.push(input.company_resolution_error)
  } else if (!input.company_candidate_id) {
    blockers.push(
      `Target company not found in growth.discovery_candidates: ${APOLLO_MAPPING_AUDIT_MEDICAL_EQUIPMENT_SOLUTIONS.company_name}`,
    )
  }

  const config_diagnostics = diagnoseApolloContactDiscoveryConfig(env)

  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: APOLLO_SCALE_5_PRODUCTION_ROUTE_QA_MARKER,
    checked_at: input.nowIso ?? new Date().toISOString(),
    ready: gates.ok && Boolean(input.company_candidate_id) && !input.company_resolution_error,
    production_runtime: isApolloScale5ProductionRuntime(env),
    target_company: APOLLO_MAPPING_AUDIT_MEDICAL_EQUIPMENT_SOLUTIONS,
    company_candidate_id: input.company_candidate_id,
    contact_limit: gates.contact_limit,
    apollo_credits_required: true,
    blockers,
    config_diagnostics,
    browser_console_execute_snippet: APOLLO_SCALE_5_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    runtime: {
      node_env: env.NODE_ENV ?? null,
      vercel_env: env.VERCEL_ENV ?? null,
    },
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloScale5ProductionSecrets }
