/** Apollo Account Playbooks route gates — client-safe. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import {
  APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
  APOLLO_ACCOUNT_PLAYBOOKS_MIGRATION,
} from "@/lib/growth/apollo/apollo-account-playbooks-types"
import {
  assertApolloEnrollmentAutomationExecuteAllowed,
  buildApolloEnrollmentAutomationReadinessPayload,
} from "@/lib/growth/apollo/apollo-enrollment-automation-route-gates"
import { isApolloScale2ProductionRuntime } from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"

export const APOLLO_ACCOUNT_PLAYBOOKS_ROUTE_QA_MARKER =
  "apollo-account-playbooks-route-abp-1-v1" as const

export const APOLLO_ACCOUNT_PLAYBOOKS_EXECUTE_CONFIRM = "RUN_APOLLO_ACCOUNT_PLAYBOOKS" as const

export const APOLLO_ACCOUNT_PLAYBOOKS_CERTIFICATION_EXECUTE_CONFIRM =
  "RUN_APOLLO_ACCOUNT_PLAYBOOKS_CERTIFICATION" as const

export const APOLLO_ACCOUNT_PLAYBOOKS_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo Account Playbooks (ABP-1) — intelligence + queue only (Vercel Production)
await fetch("/api/platform/growth/apollo-account-playbooks/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("account-playbooks readiness", payload))

await fetch("/api/platform/growth/apollo-account-playbooks/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    confirm: "${APOLLO_ACCOUNT_PLAYBOOKS_EXECUTE_CONFIRM}",
    enrollmentCandidateId: "<enrollment-approved-candidate-id>",
  }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("execution_id", payload.execution_id)
    console.log("playbooks_created", payload.report?.playbooks_created)
    console.log("funnel", payload.report?.funnel_metrics)
    return payload
  })`

export function isApolloAccountPlaybooksEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_APOLLO_ACCOUNT_PLAYBOOKS_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function assertApolloAccountPlaybooksExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ReturnType<typeof assertApolloEnrollmentAutomationExecuteAllowed> {
  const blockers: string[] = []
  const base = assertApolloEnrollmentAutomationExecuteAllowed({
    ...env,
    GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ENABLED:
      env.GROWTH_APOLLO_ACCOUNT_PLAYBOOKS_ENABLED ?? env.GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ENABLED,
    GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ACK:
      env.GROWTH_APOLLO_ACCOUNT_PLAYBOOKS_ACK ?? env.GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ACK,
  } as NodeJS.ProcessEnv)

  if (!isApolloAccountPlaybooksEnabled(env)) {
    blockers.push("GROWTH_APOLLO_ACCOUNT_PLAYBOOKS_ENABLED must be true")
  }
  if (env.GROWTH_APOLLO_ACCOUNT_PLAYBOOKS_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_ACCOUNT_PLAYBOOKS_ACK must be 1")
  }

  return {
    ...base,
    ok: base.ok && blockers.length === 0,
    blockers: [...blockers, ...base.blockers],
    error: blockers[0] ?? base.error,
    company_limit: base.company_limit,
  }
}

export function validateApolloAccountPlaybooksConfirmation(body: unknown): {
  ok: boolean
  error: string | null
  enrollment_candidate_id: string | null
  certification_mode: boolean
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must include confirm: "${APOLLO_ACCOUNT_PLAYBOOKS_EXECUTE_CONFIRM}".`,
      enrollment_candidate_id: null,
      certification_mode: false,
    }
  }

  const record = body as Record<string, unknown>
  const confirm = typeof record.confirm === "string" ? record.confirm.trim() : ""
  const enrollmentCandidateId =
    typeof record.enrollmentCandidateId === "string"
      ? record.enrollmentCandidateId.trim()
      : typeof record.enrollment_candidate_id === "string"
        ? record.enrollment_candidate_id.trim()
        : ""

  const certification_mode = confirm === APOLLO_ACCOUNT_PLAYBOOKS_CERTIFICATION_EXECUTE_CONFIRM
  const execute_mode = confirm === APOLLO_ACCOUNT_PLAYBOOKS_EXECUTE_CONFIRM

  if (!certification_mode && !execute_mode) {
    return {
      ok: false,
      error: `confirm must be "${APOLLO_ACCOUNT_PLAYBOOKS_EXECUTE_CONFIRM}" or "${APOLLO_ACCOUNT_PLAYBOOKS_CERTIFICATION_EXECUTE_CONFIRM}".`,
      enrollment_candidate_id: null,
      certification_mode: false,
    }
  }

  if (!enrollmentCandidateId) {
    return {
      ok: false,
      error: "enrollmentCandidateId is required.",
      enrollment_candidate_id: null,
      certification_mode,
    }
  }

  return {
    ok: true,
    error: null,
    enrollment_candidate_id: enrollmentCandidateId,
    certification_mode,
  }
}

export function buildApolloAccountPlaybooksReadinessPayload(input?: {
  env?: NodeJS.ProcessEnv
  enrollment_candidate_id?: string | null
}) {
  const env = input?.env ?? process.env
  const gates = assertApolloAccountPlaybooksExecuteAllowed(env)
  const enrollmentReadiness = buildApolloEnrollmentAutomationReadinessPayload({ env })

  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: APOLLO_ACCOUNT_PLAYBOOKS_ROUTE_QA_MARKER,
    automation_qa_marker: APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
    migration: APOLLO_ACCOUNT_PLAYBOOKS_MIGRATION,
    gates_ok: gates.ok,
    blockers: gates.blockers,
    production_runtime: isApolloScale2ProductionRuntime(env),
    enrollment_candidate_id: input?.enrollment_candidate_id ?? null,
    execute_confirm: APOLLO_ACCOUNT_PLAYBOOKS_EXECUTE_CONFIRM,
    certification_confirm: APOLLO_ACCOUNT_PLAYBOOKS_CERTIFICATION_EXECUTE_CONFIRM,
    browser_console_snippet: APOLLO_ACCOUNT_PLAYBOOKS_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    safety: {
      outreach_sent: false,
    },
    funnel_stage: "Account Playbook Ready",
    pipeline_position: "Enrollment → Account Playbook → Voice Drop → Multi-Channel Sequence",
    enrollment_readiness: enrollmentReadiness,
  })
}

export function redactApolloAccountPlaybooksSecrets<T extends Record<string, unknown>>(payload: T): T {
  return redactApolloEnrichmentCertProductionSecrets(payload)
}
