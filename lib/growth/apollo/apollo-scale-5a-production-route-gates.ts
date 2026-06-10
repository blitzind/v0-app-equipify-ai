/** Apollo-Scale-5A contactable eligibility audit production route gates — evidence only. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import { APOLLO_MAPPING_AUDIT_MEDICAL_EQUIPMENT_SOLUTIONS } from "@/lib/growth/apollo/apollo-mapped-contact-pipeline-audit"

export const APOLLO_SCALE_5A_ROUTE_QA_MARKER = "apollo-scale-5a-contactable-eligibility-audit-route-v1" as const

export const APOLLO_SCALE_5A_EXECUTE_CONFIRM = "RUN_APOLLO_SCALE_5A" as const

export const APOLLO_SCALE_5A_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo-Scale-5A — contactable eligibility audit (Medical Equipment Solutions)
await fetch("/api/platform/growth/apollo-scale-5a/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("scale-5a readiness", payload))

await fetch("/api/platform/growth/apollo-scale-5a/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ confirm: "${APOLLO_SCALE_5A_EXECUTE_CONFIRM}" }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("blocker_frequency", payload.report?.blocker_frequency)
    payload.report?.contacts?.forEach((contact) => {
      console.log(
        contact.full_name,
        "scale5_blocker=",
        contact.scale5_blocker,
        "first_gate=",
        contact.first_failing_gate,
      )
      contact.contactable_traces?.forEach((trace) => {
        console.log(" ", trace.evaluator, trace.contactable, trace.first_failing_gate, trace.blocker)
      })
    })
    return payload
  })`

export function assertApolloScale5AExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): { ok: boolean; error: string | null; blockers: string[] } {
  const blockers: string[] = []

  if (env.VERCEL_ENV !== "production") {
    blockers.push("VERCEL_ENV must be production (Vercel Production deployment only)")
  }
  if (env.GROWTH_APOLLO_SCALE_5A_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_SCALE_5A_ACK must be 1")
  }

  return { ok: blockers.length === 0, error: blockers[0] ?? null, blockers }
}

export function validateApolloScale5AConfirmation(body: unknown): {
  ok: boolean
  error: string | null
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_SCALE_5A_EXECUTE_CONFIRM}".`,
    }
  }
  const record = body as Record<string, unknown>
  if (record.confirm !== APOLLO_SCALE_5A_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_SCALE_5A_EXECUTE_CONFIRM}".`,
    }
  }
  return { ok: true, error: null }
}

export function buildApolloScale5AReadinessPayload(input?: {
  env?: NodeJS.ProcessEnv
  nowIso?: string
}) {
  const env = input?.env ?? process.env
  const gates = assertApolloScale5AExecuteAllowed(env)
  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: APOLLO_SCALE_5A_ROUTE_QA_MARKER,
    checked_at: input?.nowIso ?? new Date().toISOString(),
    ready: gates.ok,
    target_company: APOLLO_MAPPING_AUDIT_MEDICAL_EQUIPMENT_SOLUTIONS,
    verified_contacts: [
      "Tanya Powell",
      "Jonathan Branch",
      "Scott Alexander",
      "Kimberly Woolsey",
    ],
    apollo_credits_required: false,
    blockers: gates.blockers,
    browser_console_execute_snippet: APOLLO_SCALE_5A_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    runtime: {
      node_env: env.NODE_ENV ?? null,
      vercel_env: env.VERCEL_ENV ?? null,
    },
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloScale5ASecrets }
