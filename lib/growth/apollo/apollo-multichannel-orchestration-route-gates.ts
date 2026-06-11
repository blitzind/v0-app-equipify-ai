/** Apollo Multi-Channel Orchestration route gates — client-safe. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import { APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER } from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import {
  assertApolloVoiceDropAutomationExecuteAllowed,
  buildApolloVoiceDropAutomationReadinessPayload,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-route-gates"
import { isApolloScale2ProductionRuntime } from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"

export const APOLLO_MULTICHANNEL_ORCHESTRATION_ROUTE_QA_MARKER =
  "apollo-multichannel-orchestration-route-v1" as const

export const APOLLO_MULTICHANNEL_ORCHESTRATION_EXECUTE_CONFIRM =
  "RUN_APOLLO_MULTICHANNEL_ORCHESTRATION" as const

export const APOLLO_MULTICHANNEL_CERTIFICATION_EXECUTE_CONFIRM =
  "RUN_APOLLO_MULTICHANNEL_CERTIFICATION" as const

export const APOLLO_MULTICHANNEL_ORCHESTRATION_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo Multi-Channel Orchestration — plans + queue only (Vercel Production)
await fetch("/api/platform/growth/apollo-multichannel-orchestration/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("multichannel-orchestration readiness", payload))

await fetch("/api/platform/growth/apollo-multichannel-orchestration/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    confirm: "${APOLLO_MULTICHANNEL_ORCHESTRATION_EXECUTE_CONFIRM}",
    voiceDropCandidateId: "<voice-drop-approved-candidate-id>",
  }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("execution_id", payload.execution_id)
    console.log("candidates_created", payload.report?.candidates_created)
    console.log("funnel", payload.report?.funnel_metrics)
    console.log("scheduling", payload.report?.candidates?.[0]?.scheduling_plan)
    return payload
  })`

export function isApolloMultichannelOrchestrationEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function assertApolloMultichannelOrchestrationExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ReturnType<typeof assertApolloVoiceDropAutomationExecuteAllowed> {
  const blockers: string[] = []
  const base = assertApolloVoiceDropAutomationExecuteAllowed({
    ...env,
    GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ENABLED:
      env.GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ENABLED ??
      env.GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ENABLED,
    GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ACK:
      env.GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ACK ?? env.GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ACK,
  } as NodeJS.ProcessEnv)

  if (!isApolloMultichannelOrchestrationEnabled(env)) {
    blockers.push("GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ENABLED must be true")
  }
  if (env.GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ACK must be 1")
  }

  return {
    ...base,
    ok: base.ok && blockers.length === 0,
    blockers: [...blockers, ...base.blockers],
    error: blockers[0] ?? base.error,
    company_limit: base.company_limit,
  }
}

export function validateApolloMultichannelOrchestrationConfirmation(body: unknown): {
  ok: boolean
  error: string | null
  voice_drop_candidate_id: string | null
  certification_mode: boolean
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must include confirm: "${APOLLO_MULTICHANNEL_ORCHESTRATION_EXECUTE_CONFIRM}".`,
      voice_drop_candidate_id: null,
      certification_mode: false,
    }
  }

  const record = body as Record<string, unknown>
  const confirm = typeof record.confirm === "string" ? record.confirm.trim() : ""
  const certification_mode = confirm === APOLLO_MULTICHANNEL_CERTIFICATION_EXECUTE_CONFIRM

  if (
    confirm !== APOLLO_MULTICHANNEL_ORCHESTRATION_EXECUTE_CONFIRM &&
    confirm !== APOLLO_MULTICHANNEL_CERTIFICATION_EXECUTE_CONFIRM
  ) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_MULTICHANNEL_ORCHESTRATION_EXECUTE_CONFIRM}" or "${APOLLO_MULTICHANNEL_CERTIFICATION_EXECUTE_CONFIRM}".`,
      voice_drop_candidate_id: null,
      certification_mode: false,
    }
  }

  const voiceDropCandidateId =
    (typeof record.voiceDropCandidateId === "string" ? record.voiceDropCandidateId.trim() : "") ||
    (typeof record.voice_drop_candidate_id === "string" ? record.voice_drop_candidate_id.trim() : "") ||
    null

  if (!voiceDropCandidateId) {
    return {
      ok: false,
      error: "voiceDropCandidateId is required.",
      voice_drop_candidate_id: null,
      certification_mode,
    }
  }

  return {
    ok: true,
    error: null,
    voice_drop_candidate_id: voiceDropCandidateId,
    certification_mode,
  }
}

export function buildApolloMultichannelOrchestrationReadinessPayload(input?: {
  env?: NodeJS.ProcessEnv
  voice_drop_candidate_id?: string | null
}) {
  const env = input?.env ?? process.env
  const gates = assertApolloMultichannelOrchestrationExecuteAllowed(env)
  const base = buildApolloVoiceDropAutomationReadinessPayload({
    env,
    enrollment_candidate_id: null,
  })

  return redactApolloEnrichmentCertProductionSecrets({
    ok: gates.ok,
    qa_marker: APOLLO_MULTICHANNEL_ORCHESTRATION_ROUTE_QA_MARKER,
    automation_qa_marker: APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
    auth_method: "platform_admin",
    production_runtime: isApolloScale2ProductionRuntime(env),
    execute_confirm: APOLLO_MULTICHANNEL_ORCHESTRATION_EXECUTE_CONFIRM,
    certification_execute_confirm: APOLLO_MULTICHANNEL_CERTIFICATION_EXECUTE_CONFIRM,
    browser_console_execute_snippet: APOLLO_MULTICHANNEL_ORCHESTRATION_BROWSER_CONSOLE_EXECUTE_SNIPPET,
    gates_ok: gates.ok,
    blockers: gates.blockers,
    outreach_sent: false,
    voice_drop_sent: false,
    draft_created: false,
    jobs_scheduled: false,
    live_outreach_allowed: false,
    pipeline: ["Apollo", "Qualification", "Enrollment", "Voice Drop", "Multi-Channel Sequence"],
    ...base,
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloMultichannelOrchestrationSecrets }
