/** Apollo mapping pipeline audit production route gates — evidence only. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import { APOLLO_MAPPING_AUDIT_MEDICAL_EQUIPMENT_SOLUTIONS } from "@/lib/growth/apollo/apollo-mapped-contact-pipeline-audit"
import {
  diagnoseApolloContactDiscoveryConfig,
  type ApolloConfigDiagnostics,
} from "@/lib/growth/providers/apollo/apollo-config-diagnostics"
import { isApolloMockEnabled } from "@/lib/growth/providers/apollo/apollo-config"

export const APOLLO_MAPPING_PIPELINE_AUDIT_ROUTE_QA_MARKER =
  "apollo-mapping-pipeline-audit-route-v1" as const

export const APOLLO_MAPPING_PIPELINE_AUDIT_EXECUTE_CONFIRM =
  "RUN_APOLLO_MAPPING_PIPELINE_AUDIT" as const

export const APOLLO_MAPPING_PIPELINE_AUDIT_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo mapping pipeline audit — Medical Equipment Solutions
await fetch("/api/platform/growth/apollo-mapping-pipeline-audit/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("mapping pipeline audit readiness", payload))

await fetch("/api/platform/growth/apollo-mapping-pipeline-audit/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ confirm: "${APOLLO_MAPPING_PIPELINE_AUDIT_EXECUTE_CONFIRM}" }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("blocker_frequency", payload.report?.blocker_frequency)
    payload.report?.contacts?.forEach((c) => {
      console.log(c.full_name, c.first_failure_stage, c.first_failure_blocker)
    })
    return payload
  })`

export function assertApolloMappingPipelineAuditExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): { ok: boolean; error: string | null; blockers: string[] } {
  const blockers: string[] = []

  if (env.VERCEL_ENV !== "production") {
    blockers.push("VERCEL_ENV must be production (Vercel Production deployment only)")
  }
  if (env.GROWTH_APOLLO_MAPPING_PIPELINE_AUDIT_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_MAPPING_PIPELINE_AUDIT_ACK must be 1")
  }
  if (env.GROWTH_APOLLO_LIVE_BENCHMARK_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_LIVE_BENCHMARK_ACK must be 1 for live Apollo credit usage")
  }
  if (isApolloMockEnabled(env)) {
    blockers.push("GROWTH_APOLLO_USE_MOCK must be false for live mapping pipeline audit")
  }

  const config = diagnoseApolloContactDiscoveryConfig(env)
  if (!config.ready_for_live_benchmark) {
    for (const issue of config.issues) {
      if (issue.severity === "error") blockers.push(issue.message)
    }
  }

  return { ok: blockers.length === 0, error: blockers[0] ?? null, blockers }
}

export function validateApolloMappingPipelineAuditConfirmation(body: unknown): {
  ok: boolean
  error: string | null
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_MAPPING_PIPELINE_AUDIT_EXECUTE_CONFIRM}".`,
    }
  }
  const record = body as Record<string, unknown>
  if (record.confirm !== APOLLO_MAPPING_PIPELINE_AUDIT_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_MAPPING_PIPELINE_AUDIT_EXECUTE_CONFIRM}".`,
    }
  }
  return { ok: true, error: null }
}

export function buildApolloMappingPipelineAuditReadinessPayload(input?: {
  env?: NodeJS.ProcessEnv
  nowIso?: string
}): {
  qa_marker: typeof APOLLO_MAPPING_PIPELINE_AUDIT_ROUTE_QA_MARKER
  checked_at: string
  ready: boolean
  target_company: typeof APOLLO_MAPPING_AUDIT_MEDICAL_EQUIPMENT_SOLUTIONS
  blockers: string[]
  config_diagnostics: ApolloConfigDiagnostics
  browser_console_execute_snippet: typeof APOLLO_MAPPING_PIPELINE_AUDIT_BROWSER_CONSOLE_EXECUTE_SNIPPET
} {
  const env = input?.env ?? process.env
  const gates = assertApolloMappingPipelineAuditExecuteAllowed(env)
  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: APOLLO_MAPPING_PIPELINE_AUDIT_ROUTE_QA_MARKER,
    checked_at: input?.nowIso ?? new Date().toISOString(),
    ready: gates.ok,
    target_company: APOLLO_MAPPING_AUDIT_MEDICAL_EQUIPMENT_SOLUTIONS,
    blockers: gates.blockers,
    config_diagnostics: diagnoseApolloContactDiscoveryConfig(env),
    browser_console_execute_snippet: APOLLO_MAPPING_PIPELINE_AUDIT_BROWSER_CONSOLE_EXECUTE_SNIPPET,
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloMappingPipelineAuditSecrets }
