/** Phase GS-3E — Human Intervention route gates (client-safe). */

import {
  HUMAN_INTERVENTION_ACTIONS,
  HUMAN_INTERVENTION_CONFIRM,
  HUMAN_INTERVENTION_QA_MARKER,
} from "@/lib/growth/human-interventions/human-intervention-types"

export { HUMAN_INTERVENTION_CONFIRM }

export const HUMAN_INTERVENTION_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "Interventions orchestrate GS-1D/1E queues, human execution, and readiness signals — no duplicate stores.",
  "Human intervention engine is routing and recommendations only — no outreach or autonomous execution.",
  "All interventions require explicit operator review before downstream action.",
  "Audit events persist to growth.signal_events only.",
] as const

export function assertHumanInterventionExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export function buildHumanInterventionReadinessPayload() {
  return {
    qa_marker: HUMAN_INTERVENTION_QA_MARKER,
    execute_confirm: HUMAN_INTERVENTION_CONFIRM,
    allowed_actions: HUMAN_INTERVENTION_ACTIONS,
    no_outreach_execution: true,
    no_enrollment_execution: true,
    no_auto_reply: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    checklist: HUMAN_INTERVENTION_READINESS_CHECKLIST,
  }
}
