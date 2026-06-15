/** Phase GS-6A — Command Center Unification route gates (client-safe). */

import {
  COMMAND_CENTER_UNIFICATION_ACTIONS,
  COMMAND_CENTER_UNIFICATION_CONFIRM,
  COMMAND_CENTER_UNIFICATION_QA_MARKER,
} from "@/lib/growth/command-center-unification/command-center-unification-types"

export { COMMAND_CENTER_UNIFICATION_CONFIRM }

export const COMMAND_CENTER_UNIFICATION_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "Command center unification reuses all GS subsystems — no duplicate stores.",
  "Unification is read-only aggregation — no outreach, enrollment, or autonomous execution.",
  "All workspace views require explicit operator review before any campaign action.",
  "Audit events persist to growth.signal_events only.",
] as const

export function assertCommandCenterUnificationExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export function buildCommandCenterUnificationReadinessPayload() {
  return {
    qa_marker: COMMAND_CENTER_UNIFICATION_QA_MARKER,
    execute_confirm: COMMAND_CENTER_UNIFICATION_CONFIRM,
    allowed_actions: COMMAND_CENTER_UNIFICATION_ACTIONS,
    no_outreach_execution: true,
    no_enrollment_execution: true,
    no_auto_reply: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    checklist: COMMAND_CENTER_UNIFICATION_READINESS_CHECKLIST,
  }
}
