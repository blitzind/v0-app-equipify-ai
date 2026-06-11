/** Apollo single-company enrichment diagnostic route gates — enrichment-only, no promotion. Client-safe. */

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

export const APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_QA_MARKER =
  "apollo-single-company-enrichment-diagnostic-v1" as const

export const APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_EXECUTE_CONFIRM =
  "RUN_APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC" as const

export const APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo single-company enrichment diagnostic — bulk_match only (no promotion/outreach)
await fetch("/api/platform/growth/apollo-single-company-enrichment/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("apollo single-company enrichment readiness", payload))

await fetch("/api/platform/growth/apollo-single-company-enrichment/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    confirm: "${APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_EXECUTE_CONFIRM}",
    company_name: "Stat Biomedical Technicians, Inc.",
  }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("company", payload.company)
    console.log("enrichment_evidence", payload.enrichment_evidence)
    console.log("mapped_contacts", payload.enrichment_evidence?.mapped_contacts)
    return payload
  })`

export function isApolloSingleCompanyEnrichmentDiagnosticProductionRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.VERCEL_ENV === "production"
}

export function assertApolloSingleCompanyEnrichmentDiagnosticExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): { ok: boolean; error: string | null; blockers: string[] } {
  const blockers: string[] = []

  if (!isApolloSingleCompanyEnrichmentDiagnosticProductionRuntime(env)) {
    blockers.push("VERCEL_ENV must be production (Vercel Production deployment only)")
  }

  if (env.GROWTH_APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_ACK must be 1")
  }

  if (env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_LIVE_BENCHMARK_ACK must be 1 for live Apollo credit usage")
  }

  if (isApolloMockEnabled(env)) {
    blockers.push("GROWTH_APOLLO_USE_MOCK must be false for live enrichment diagnostic")
  }

  if (!isApolloProviderConfigured(env)) {
    blockers.push("Apollo provider not configured")
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

export function validateApolloSingleCompanyEnrichmentDiagnosticConfirmation(body: unknown): {
  ok: boolean
  error: string | null
  company_candidate_id: string | null
  company_name: string | null
  rerun_search: boolean
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_EXECUTE_CONFIRM}" and company_candidate_id or company_name.`,
      company_candidate_id: null,
      company_name: null,
      rerun_search: false,
    }
  }
  const record = body as Record<string, unknown>
  if (record.confirm !== APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_EXECUTE_CONFIRM}".`,
      company_candidate_id: null,
      company_name: null,
      rerun_search: false,
    }
  }

  const company_candidate_id =
    typeof record.company_candidate_id === "string" ? record.company_candidate_id.trim() : ""
  const company_name = typeof record.company_name === "string" ? record.company_name.trim() : ""
  const rerun_search = record.rerun_search === true

  if (!company_candidate_id && !company_name) {
    return {
      ok: false,
      error: "Provide company_candidate_id or company_name.",
      company_candidate_id: null,
      company_name: null,
      rerun_search: false,
    }
  }

  return {
    ok: true,
    error: null,
    company_candidate_id: company_candidate_id || null,
    company_name: company_name || null,
    rerun_search,
  }
}

export function buildApolloSingleCompanyEnrichmentDiagnosticReadinessPayload(input?: {
  env?: NodeJS.ProcessEnv
  nowIso?: string
}) {
  const env = input?.env ?? process.env
  const gates = assertApolloSingleCompanyEnrichmentDiagnosticExecuteAllowed(env)
  const blockers = [...gates.blockers]

  if (!isApolloEmailEnrichmentEnabled(env)) {
    blockers.push("GROWTH_APOLLO_ENRICH_EMAILS must be true (search-only mode blocks bulk_match)")
  }
  if (env.GROWTH_APOLLO_ENRICH_EMAILS_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_ENRICH_EMAILS_ACK must be 1")
  }

  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_QA_MARKER,
    checked_at: input?.nowIso ?? new Date().toISOString(),
    ready: gates.ok && blockers.length === gates.blockers.length,
    production_runtime: isApolloSingleCompanyEnrichmentDiagnosticProductionRuntime(env),
    enrich_emails_enabled: isApolloEmailEnrichmentEnabled(env),
    enrich_emails_ack: env.GROWTH_APOLLO_ENRICH_EMAILS_ACK === "1",
    search_only_mode: !isApolloEmailEnrichmentEnabled(env),
    mock_mode: isApolloMockEnabled(env),
    blockers,
    config_diagnostics: diagnoseApolloContactDiscoveryConfig(env) as ApolloConfigDiagnostics,
    browser_console_execute_snippet:
      APOLLO_SINGLE_COMPANY_ENRICHMENT_DIAGNOSTIC_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    runtime: {
      node_env: env.NODE_ENV ?? null,
      vercel_env: env.VERCEL_ENV ?? null,
    },
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloSingleCompanyEnrichmentDiagnosticSecrets }
