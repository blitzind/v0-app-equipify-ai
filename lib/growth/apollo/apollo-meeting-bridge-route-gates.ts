/** Apollo Meeting Bridge route gates — client-safe. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import {
  APOLLO_MEETING_BRIDGE_MIGRATION,
  APOLLO_MEETING_BRIDGE_QA_MARKER,
} from "@/lib/growth/apollo/apollo-meeting-bridge-types"
import {
  assertApolloSequenceExecutionAutomationExecuteAllowed,
  buildApolloSequenceExecutionAutomationReadinessPayload,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-route-gates"
import { isApolloScale2ProductionRuntime } from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"

export const APOLLO_MEETING_BRIDGE_ROUTE_QA_MARKER = "apollo-meeting-bridge-route-m1a-v1" as const

export const APOLLO_MEETING_BRIDGE_EXECUTE_CONFIRM = "RUN_APOLLO_MEETING_BRIDGE" as const

export const APOLLO_MEETING_BRIDGE_CERTIFICATION_EXECUTE_CONFIRM =
  "RUN_APOLLO_MEETING_BRIDGE_CERTIFICATION" as const

export const APOLLO_MEETING_BRIDGE_BROWSER_CONSOLE_EXECUTE_SNIPPET = `// Apollo Meeting Bridge (M1-A) — candidate queue only (Vercel Production)
await fetch("/api/platform/growth/apollo-meeting-bridge/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => console.log("meeting-bridge readiness", payload))

await fetch("/api/platform/growth/apollo-meeting-bridge/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    confirm: "${APOLLO_MEETING_BRIDGE_EXECUTE_CONFIRM}",
    sequenceExecutionCandidateId: "<sequence-execution-candidate-id>",
  }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("execution_id", payload.execution_id)
    console.log("candidates_created", payload.report?.candidates_created)
    console.log("funnel", payload.report?.funnel_metrics)
    return payload
  })`

export function isApolloMeetingBridgeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GROWTH_APOLLO_MEETING_BRIDGE_ENABLED?.trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes"
}

export function assertApolloMeetingBridgeExecuteAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ReturnType<typeof assertApolloSequenceExecutionAutomationExecuteAllowed> {
  const blockers: string[] = []
  const base = assertApolloSequenceExecutionAutomationExecuteAllowed({
    ...env,
    GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ENABLED:
      env.GROWTH_APOLLO_MEETING_BRIDGE_ENABLED ??
      env.GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ENABLED,
    GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ACK:
      env.GROWTH_APOLLO_MEETING_BRIDGE_ACK ?? env.GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ACK,
  } as NodeJS.ProcessEnv)

  if (!isApolloMeetingBridgeEnabled(env)) {
    blockers.push("GROWTH_APOLLO_MEETING_BRIDGE_ENABLED must be true")
  }
  if (env.GROWTH_APOLLO_MEETING_BRIDGE_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_MEETING_BRIDGE_ACK must be 1")
  }

  return {
    ...base,
    ok: base.ok && blockers.length === 0,
    blockers: [...blockers, ...base.blockers],
    error: blockers[0] ?? base.error,
    company_limit: base.company_limit,
  }
}

export function validateApolloMeetingBridgeConfirmation(body: unknown): {
  ok: boolean
  error: string | null
  sequence_execution_candidate_id: string | null
  certification_mode: boolean
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must include confirm: "${APOLLO_MEETING_BRIDGE_EXECUTE_CONFIRM}".`,
      sequence_execution_candidate_id: null,
      certification_mode: false,
    }
  }

  const record = body as Record<string, unknown>
  const confirm = typeof record.confirm === "string" ? record.confirm.trim() : ""
  const sequenceExecutionCandidateId =
    typeof record.sequenceExecutionCandidateId === "string"
      ? record.sequenceExecutionCandidateId.trim()
      : typeof record.sequence_execution_candidate_id === "string"
        ? record.sequence_execution_candidate_id.trim()
        : ""

  if (
    confirm !== APOLLO_MEETING_BRIDGE_EXECUTE_CONFIRM &&
    confirm !== APOLLO_MEETING_BRIDGE_CERTIFICATION_EXECUTE_CONFIRM
  ) {
    return {
      ok: false,
      error: `Invalid confirm. Expected "${APOLLO_MEETING_BRIDGE_EXECUTE_CONFIRM}" or certification confirm.`,
      sequence_execution_candidate_id: null,
      certification_mode: false,
    }
  }

  if (!sequenceExecutionCandidateId) {
    return {
      ok: false,
      error: "sequenceExecutionCandidateId is required.",
      sequence_execution_candidate_id: null,
      certification_mode: false,
    }
  }

  return {
    ok: true,
    error: null,
    sequence_execution_candidate_id: sequenceExecutionCandidateId,
    certification_mode: confirm === APOLLO_MEETING_BRIDGE_CERTIFICATION_EXECUTE_CONFIRM,
  }
}

export function buildApolloMeetingBridgeReadinessPayload(input?: {
  env?: NodeJS.ProcessEnv
  sequence_execution_candidate_id?: string | null
}) {
  const env = input?.env ?? process.env
  const gates = assertApolloMeetingBridgeExecuteAllowed(env)
  const sequenceBase = buildApolloSequenceExecutionAutomationReadinessPayload({
    env,
    sequence_execution_candidate_id: input?.sequence_execution_candidate_id ?? null,
  })

  return redactApolloEnrichmentCertProductionSecrets({
    qa_marker: APOLLO_MEETING_BRIDGE_ROUTE_QA_MARKER,
    bridge_qa_marker: APOLLO_MEETING_BRIDGE_QA_MARKER,
    migration: APOLLO_MEETING_BRIDGE_MIGRATION,
    funnel_stage: "Meeting Candidates Ready",
    pipeline_position: "Sequence Execution → Reply Intelligence → Meeting Candidate",
    enabled: isApolloMeetingBridgeEnabled(env),
    gates_ok: gates.ok,
    blockers: gates.blockers,
    production_runtime: isApolloScale2ProductionRuntime(env),
    sequence_execution_readiness: sequenceBase,
    trigger_rules: {
      reply_intents: [
        "meeting_request",
        "demo_request",
        "positive_interest",
        "pricing_question",
      ],
      qualification_signals: ["call_ready", "sales_ready"],
    },
    safety: {
      outreach_sent: false,
      calendar_written: false,
      meeting_scheduled: false,
    },
    browser_console_execute_snippet: APOLLO_MEETING_BRIDGE_BROWSER_CONSOLE_EXECUTE_SNIPPET,
  })
}

export function redactApolloMeetingBridgeSecrets<T extends Record<string, unknown>>(payload: T): T {
  return redactApolloEnrichmentCertProductionSecrets(payload)
}
