/** Apollo Sequence Execution Automation route gates — client-safe. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import { APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import {
  assertApolloMultichannelOrchestrationExecuteAllowed,
  buildApolloMultichannelOrchestrationReadinessPayload,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-route-gates"
import { isApolloScale2ProductionRuntime } from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"

export const APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ROUTE_QA_MARKER =
  "apollo-sequence-execution-automation-route-v1" as const

export const APOLLO_SEQUENCE_EXECUTION_AUTOMATION_EXECUTE_CONFIRM =
  "RUN_APOLLO_SEQUENCE_EXECUTION_AUTOMATION" as const

export const APOLLO_SEQUENCE_EXECUTION_CERTIFICATION_EXECUTE_CONFIRM =
  "RUN_APOLLO_SEQUENCE_EXECUTION_CERTIFICATION" as const

export const APOLLO_SEQUENCE_EXECUTION_AUTOMATION_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo Sequence Execution Automation — materialize + queue only (Vercel Production)
await fetch("/api/platform/growth/apollo-sequence-execution-automation/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("sequence-execution-automation readiness", payload))

await fetch("/api/platform/growth/apollo-sequence-execution-automation/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    confirm: "${APOLLO_SEQUENCE_EXECUTION_AUTOMATION_EXECUTE_CONFIRM}",
    multichannelSequenceCandidateId: "<sequence-approved-multichannel-candidate-id>",
  }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("execution_id", payload.execution_id)
    console.log("candidates_created", payload.report?.candidates_created)
    console.log("funnel", payload.report?.funnel_metrics)
    console.log("steps", payload.report?.candidates?.[0]?.materialization?.steps)
    return payload
  })`

export function isApolloSequenceExecutionAutomationEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function assertApolloSequenceExecutionAutomationExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ReturnType<typeof assertApolloMultichannelOrchestrationExecuteAllowed> {
  const blockers: string[] = []
  const base = assertApolloMultichannelOrchestrationExecuteAllowed({
    ...env,
    GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ENABLED:
      env.GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ENABLED ??
      env.GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ENABLED,
    GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ACK:
      env.GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ACK ??
      env.GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ACK,
  } as NodeJS.ProcessEnv)

  if (!isApolloSequenceExecutionAutomationEnabled(env)) {
    blockers.push("GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ENABLED must be true")
  }
  if (env.GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ACK must be 1")
  }

  return {
    ...base,
    ok: base.ok && blockers.length === 0,
    blockers: [...blockers, ...base.blockers],
    error: blockers[0] ?? base.error,
    company_limit: base.company_limit,
  }
}

export function validateApolloSequenceExecutionAutomationConfirmation(body: unknown): {
  ok: boolean
  error: string | null
  multichannel_sequence_candidate_id: string | null
  certification_mode: boolean
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must include confirm: "${APOLLO_SEQUENCE_EXECUTION_AUTOMATION_EXECUTE_CONFIRM}".`,
      multichannel_sequence_candidate_id: null,
      certification_mode: false,
    }
  }

  const record = body as Record<string, unknown>
  const confirm = typeof record.confirm === "string" ? record.confirm.trim() : ""
  const certification_mode = confirm === APOLLO_SEQUENCE_EXECUTION_CERTIFICATION_EXECUTE_CONFIRM

  if (
    confirm !== APOLLO_SEQUENCE_EXECUTION_AUTOMATION_EXECUTE_CONFIRM &&
    confirm !== APOLLO_SEQUENCE_EXECUTION_CERTIFICATION_EXECUTE_CONFIRM
  ) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_SEQUENCE_EXECUTION_AUTOMATION_EXECUTE_CONFIRM}" or "${APOLLO_SEQUENCE_EXECUTION_CERTIFICATION_EXECUTE_CONFIRM}".`,
      multichannel_sequence_candidate_id: null,
      certification_mode: false,
    }
  }

  const multichannelSequenceCandidateId =
    (typeof record.multichannelSequenceCandidateId === "string"
      ? record.multichannelSequenceCandidateId.trim()
      : "") ||
    (typeof record.multichannel_sequence_candidate_id === "string"
      ? record.multichannel_sequence_candidate_id.trim()
      : "") ||
    null

  if (!multichannelSequenceCandidateId) {
    return {
      ok: false,
      error: "multichannelSequenceCandidateId is required.",
      multichannel_sequence_candidate_id: null,
      certification_mode,
    }
  }

  return {
    ok: true,
    error: null,
    multichannel_sequence_candidate_id: multichannelSequenceCandidateId,
    certification_mode,
  }
}

export function buildApolloSequenceExecutionAutomationReadinessPayload(input?: {
  env?: NodeJS.ProcessEnv
  multichannel_sequence_candidate_id?: string | null
}) {
  const env = input?.env ?? process.env
  const gates = assertApolloSequenceExecutionAutomationExecuteAllowed(env)
  const base = buildApolloMultichannelOrchestrationReadinessPayload({ env })

  return redactApolloEnrichmentCertProductionSecrets({
    ok: gates.ok,
    qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ROUTE_QA_MARKER,
    automation_qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
    auth_method: "platform_admin",
    production_runtime: isApolloScale2ProductionRuntime(env),
    execute_confirm: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_EXECUTE_CONFIRM,
    certification_execute_confirm: APOLLO_SEQUENCE_EXECUTION_CERTIFICATION_EXECUTE_CONFIRM,
    browser_console_execute_snippet: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    gates_ok: gates.ok,
    blockers: gates.blockers,
    live_outreach_allowed: false,
    pipeline: [
      "Apollo",
      "Qualification",
      "Enrollment",
      "Voice Drop",
      "Multi-Channel",
      "Sequence Execution",
    ],
    ...base,
    outreach_sent: false,
    voice_drop_sent: false,
    email_sent: false,
    sms_sent: false,
    call_placed: false,
    draft_created: true,
    jobs_scheduled: false,
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloSequenceExecutionAutomationSecrets }
