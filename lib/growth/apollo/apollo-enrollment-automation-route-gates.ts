/** Apollo Enrollment Automation route gates — client-safe, no secrets. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import { APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER } from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import {
  APOLLO_ENROLLMENT_DEFAULT_QUALIFICATION_THRESHOLD,
  resolveApolloEnrollmentQualificationThreshold,
} from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"
import {
  assertApolloScale2ProductionExecuteAllowed,
  buildApolloScale2ProductionReadinessPayload,
  isApolloScale2ProductionRuntime,
} from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"

export const APOLLO_ENROLLMENT_AUTOMATION_ROUTE_QA_MARKER =
  "apollo-enrollment-automation-route-v1" as const

export const APOLLO_ENROLLMENT_AUTOMATION_EXECUTE_CONFIRM =
  "RUN_APOLLO_ENROLLMENT_AUTOMATION" as const

export const APOLLO_ENROLLMENT_CERTIFICATION_EXECUTE_CONFIRM =
  "RUN_APOLLO_ENROLLMENT_CERTIFICATION" as const

export const APOLLO_ENROLLMENT_AUTOMATION_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo Enrollment Automation — qualification + candidate creation (Vercel Production)
await fetch("/api/platform/growth/apollo-enrollment-automation/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("apollo-enrollment-automation readiness", payload))

await fetch("/api/platform/growth/apollo-enrollment-automation/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    confirm: "${APOLLO_ENROLLMENT_AUTOMATION_EXECUTE_CONFIRM}",
    companyCandidateId: "<company-candidate-id>",
  }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("execution_id", payload.execution_id)
    console.log("funnel_metrics", payload.report?.funnel_metrics)
    console.log("candidates_created", payload.report?.candidates_created)
    console.log("candidates", payload.report?.candidates)
    return payload
  })`

export function isApolloEnrollmentAutomationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function assertApolloEnrollmentAutomationExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ReturnType<typeof assertApolloScale2ProductionExecuteAllowed> {
  const blockers: string[] = []

  const base = assertApolloScale2ProductionExecuteAllowed({
    ...env,
    GROWTH_APOLLO_SCALE_2_ENABLED:
      env.GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ENABLED ?? env.GROWTH_APOLLO_SCALE_2_ENABLED,
    GROWTH_APOLLO_SCALE_2_ACK:
      env.GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ACK ?? env.GROWTH_APOLLO_SCALE_2_ACK,
  } as NodeJS.ProcessEnv)

  if (!isApolloEnrollmentAutomationEnabled(env)) {
    blockers.push("GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ENABLED must be true")
  }
  if (env.GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ACK must be 1")
  }

  return {
    ...base,
    ok: base.ok && blockers.length === 0,
    blockers: [
      ...blockers,
      ...base.blockers.filter((b) => !b.includes("GROWTH_APOLLO_SCALE_2")),
    ],
    error: blockers[0] ?? base.error,
    company_limit: base.company_limit,
  }
}

export function validateApolloEnrollmentAutomationConfirmation(body: unknown): {
  ok: boolean
  error: string | null
  company_candidate_id: string | null
  certification_mode: boolean
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must be JSON with confirm: "${APOLLO_ENROLLMENT_AUTOMATION_EXECUTE_CONFIRM}".`,
      company_candidate_id: null,
      certification_mode: false,
    }
  }

  const record = body as Record<string, unknown>
  const confirm = asString(record.confirm)
  const certification_mode = confirm === APOLLO_ENROLLMENT_CERTIFICATION_EXECUTE_CONFIRM

  if (
    confirm !== APOLLO_ENROLLMENT_AUTOMATION_EXECUTE_CONFIRM &&
    confirm !== APOLLO_ENROLLMENT_CERTIFICATION_EXECUTE_CONFIRM
  ) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_ENROLLMENT_AUTOMATION_EXECUTE_CONFIRM}" or "${APOLLO_ENROLLMENT_CERTIFICATION_EXECUTE_CONFIRM}".`,
      company_candidate_id: null,
      certification_mode: false,
    }
  }

  const companyCandidateId =
    asString(record.companyCandidateId) ||
    asString(record.company_candidate_id) ||
    null

  if (!companyCandidateId) {
    return {
      ok: false,
      error: "companyCandidateId is required.",
      company_candidate_id: null,
      certification_mode,
    }
  }

  return {
    ok: true,
    error: null,
    company_candidate_id: companyCandidateId,
    certification_mode,
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function buildApolloEnrollmentAutomationReadinessPayload(input: {
  env?: NodeJS.ProcessEnv
  company_candidate_id?: string | null
}) {
  const env = input.env ?? process.env
  const gates = assertApolloEnrollmentAutomationExecuteAllowed(env)
  const threshold = resolveApolloEnrollmentQualificationThreshold(env)
  const base = buildApolloScale2ProductionReadinessPayload({
    cohort_companies_selected: input.company_candidate_id ? 1 : 0,
    cohort_companies: input.company_candidate_id
      ? [{ company_candidate_id: input.company_candidate_id, company_name: "", domain: "" }]
      : [],
    cohort_error: null,
    env: {
      ...env,
      GROWTH_APOLLO_SCALE_2_ENABLED: env.GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ENABLED ?? "true",
      GROWTH_APOLLO_SCALE_2_ACK: env.GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ACK ?? "1",
    } as NodeJS.ProcessEnv,
  })

  return redactApolloEnrichmentCertProductionSecrets({
    ok: gates.ok,
    qa_marker: APOLLO_ENROLLMENT_AUTOMATION_ROUTE_QA_MARKER,
    automation_qa_marker: APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
    auth_method: "platform_admin",
    production_runtime: isApolloScale2ProductionRuntime(env),
    execute_confirm: APOLLO_ENROLLMENT_AUTOMATION_EXECUTE_CONFIRM,
    certification_execute_confirm: APOLLO_ENROLLMENT_CERTIFICATION_EXECUTE_CONFIRM,
    browser_console_execute_snippet: APOLLO_ENROLLMENT_AUTOMATION_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    qualification_threshold: threshold,
    default_qualification_threshold: APOLLO_ENROLLMENT_DEFAULT_QUALIFICATION_THRESHOLD,
    gates_ok: gates.ok,
    blockers: gates.blockers,
    auto_enrollment: false,
    outreach_sent: false,
    draft_creation_allowed: false,
    outreach_execution_allowed: false,
    pipeline: ["Apollo", "Enrichment", "Promotion", "Qualification", "Enrollment"],
    ...base,
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloEnrollmentAutomationSecrets }
