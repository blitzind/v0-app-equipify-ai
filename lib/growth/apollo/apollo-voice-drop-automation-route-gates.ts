/** Apollo Voice Drop Automation route gates — client-safe. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import { APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER } from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import {
  assertApolloEnrollmentAutomationExecuteAllowed,
  buildApolloEnrollmentAutomationReadinessPayload,
} from "@/lib/growth/apollo/apollo-enrollment-automation-route-gates"
import { isApolloScale2ProductionRuntime } from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"

export const APOLLO_VOICE_DROP_AUTOMATION_ROUTE_QA_MARKER =
  "apollo-voice-drop-automation-route-v1" as const

export const APOLLO_VOICE_DROP_AUTOMATION_EXECUTE_CONFIRM =
  "RUN_APOLLO_VOICE_DROP_AUTOMATION" as const

export const APOLLO_VOICE_DROP_CERTIFICATION_EXECUTE_CONFIRM =
  "RUN_APOLLO_VOICE_DROP_CERTIFICATION" as const

export const APOLLO_VOICE_DROP_AUTOMATION_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo Voice Drop Automation — intelligence + queue only (Vercel Production)
await fetch("/api/platform/growth/apollo-voice-drop-automation/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("voice-drop-automation readiness", payload))

await fetch("/api/platform/growth/apollo-voice-drop-automation/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    confirm: "${APOLLO_VOICE_DROP_AUTOMATION_EXECUTE_CONFIRM}",
    enrollmentCandidateId: "<enrollment-approved-candidate-id>",
  }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("execution_id", payload.execution_id)
    console.log("candidates_created", payload.report?.candidates_created)
    console.log("funnel", payload.report?.funnel_metrics)
    console.log("script", payload.report?.candidates?.[0]?.voice_drop_script)
    return payload
  })`

export function isApolloVoiceDropAutomationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function assertApolloVoiceDropAutomationExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ReturnType<typeof assertApolloEnrollmentAutomationExecuteAllowed> {
  const blockers: string[] = []
  const base = assertApolloEnrollmentAutomationExecuteAllowed({
    ...env,
    GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ENABLED:
      env.GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ENABLED ??
      env.GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ENABLED,
    GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ACK:
      env.GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ACK ?? env.GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ACK,
  } as NodeJS.ProcessEnv)

  if (!isApolloVoiceDropAutomationEnabled(env)) {
    blockers.push("GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ENABLED must be true")
  }
  if (env.GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ACK must be 1")
  }

  return {
    ...base,
    ok: base.ok && blockers.length === 0,
    blockers: [...blockers, ...base.blockers],
    error: blockers[0] ?? base.error,
    company_limit: base.company_limit,
  }
}

export function validateApolloVoiceDropAutomationConfirmation(body: unknown): {
  ok: boolean
  error: string | null
  enrollment_candidate_id: string | null
  certification_mode: boolean
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must include confirm: "${APOLLO_VOICE_DROP_AUTOMATION_EXECUTE_CONFIRM}".`,
      enrollment_candidate_id: null,
      certification_mode: false,
    }
  }

  const record = body as Record<string, unknown>
  const confirm = typeof record.confirm === "string" ? record.confirm.trim() : ""
  const certification_mode = confirm === APOLLO_VOICE_DROP_CERTIFICATION_EXECUTE_CONFIRM

  if (
    confirm !== APOLLO_VOICE_DROP_AUTOMATION_EXECUTE_CONFIRM &&
    confirm !== APOLLO_VOICE_DROP_CERTIFICATION_EXECUTE_CONFIRM
  ) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_VOICE_DROP_AUTOMATION_EXECUTE_CONFIRM}" or "${APOLLO_VOICE_DROP_CERTIFICATION_EXECUTE_CONFIRM}".`,
      enrollment_candidate_id: null,
      certification_mode: false,
    }
  }

  const enrollmentCandidateId =
    (typeof record.enrollmentCandidateId === "string" ? record.enrollmentCandidateId.trim() : "") ||
    (typeof record.enrollment_candidate_id === "string" ? record.enrollment_candidate_id.trim() : "") ||
    null

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

export function buildApolloVoiceDropAutomationReadinessPayload(input?: {
  env?: NodeJS.ProcessEnv
  enrollment_candidate_id?: string | null
}) {
  const env = input?.env ?? process.env
  const gates = assertApolloVoiceDropAutomationExecuteAllowed(env)
  const base = buildApolloEnrollmentAutomationReadinessPayload({
    env,
    company_candidate_id: null,
  })

  return redactApolloEnrichmentCertProductionSecrets({
    ok: gates.ok,
    qa_marker: APOLLO_VOICE_DROP_AUTOMATION_ROUTE_QA_MARKER,
    automation_qa_marker: APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
    auth_method: "platform_admin",
    production_runtime: isApolloScale2ProductionRuntime(env),
    execute_confirm: APOLLO_VOICE_DROP_AUTOMATION_EXECUTE_CONFIRM,
    certification_execute_confirm: APOLLO_VOICE_DROP_CERTIFICATION_EXECUTE_CONFIRM,
    browser_console_execute_snippet: APOLLO_VOICE_DROP_AUTOMATION_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    gates_ok: gates.ok,
    blockers: gates.blockers,
    voice_drop_sent: false,
    outreach_sent: false,
    draft_created: false,
    live_outreach_allowed: false,
    pipeline: ["Apollo", "Qualification", "Enrollment", "Voice Drop"],
    ...base,
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloVoiceDropAutomationSecrets }
