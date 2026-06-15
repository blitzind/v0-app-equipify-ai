/** Phase GS-4D — Agent Orchestration route gates (client-safe). */

import {
  AGENT_ORCHESTRATION_ACTIONS,
  AGENT_ORCHESTRATION_CONFIRM,
  AGENT_ORCHESTRATION_QA_MARKER,
} from "@/lib/growth/agent-orchestration/agent-orchestration-types"

export { AGENT_ORCHESTRATION_CONFIRM }

export const AGENT_ORCHESTRATION_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "Agent orchestration reuses readiness, inbox, previews, policies, interventions, builder, and event bus — no duplicate stores.",
  "Orchestration is planning and coordination only — no outreach, enrollment, or autonomous execution.",
  "All agent plans require explicit operator review before any campaign action.",
  "Audit events persist to growth.signal_events only.",
] as const

export function assertAgentOrchestrationExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export function buildAgentOrchestrationReadinessPayload() {
  return {
    qa_marker: AGENT_ORCHESTRATION_QA_MARKER,
    execute_confirm: AGENT_ORCHESTRATION_CONFIRM,
    allowed_actions: AGENT_ORCHESTRATION_ACTIONS,
    no_outreach_execution: true,
    no_enrollment_execution: true,
    no_auto_reply: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    checklist: AGENT_ORCHESTRATION_READINESS_CHECKLIST,
  }
}
