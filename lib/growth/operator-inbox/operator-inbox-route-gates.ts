/** Phase GS-1E — Unified Operator Inbox route gates (client-safe). */

import {
  OPERATOR_INBOX_ACTIONS,
  OPERATOR_INBOX_CONFIRM,
  OPERATOR_INBOX_QA_MARKER,
} from "@/lib/growth/operator-inbox/operator-inbox-types"

export { OPERATOR_INBOX_CONFIRM }

export const OPERATOR_INBOX_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "Unified queue reads existing signal, reply, attention, approval, and inbox stores only.",
  "Operator inbox actions update status metadata only — no outreach execution.",
  "All items require human review before any downstream execution.",
] as const

export function assertOperatorInboxExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export function buildOperatorInboxReadinessPayload() {
  return {
    qa_marker: OPERATOR_INBOX_QA_MARKER,
    execute_confirm: OPERATOR_INBOX_CONFIRM,
    allowed_actions: OPERATOR_INBOX_ACTIONS,
    no_outreach_execution: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    checklist: OPERATOR_INBOX_READINESS_CHECKLIST,
  }
}
