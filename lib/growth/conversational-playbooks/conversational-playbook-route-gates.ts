/** Phase GS-3D — Conversational Playbooks route gates (client-safe). */

import {
  CONVERSATIONAL_PLAYBOOK_ACTIONS,
  CONVERSATIONAL_PLAYBOOK_CONFIRM,
  CONVERSATIONAL_PLAYBOOK_QA_MARKER,
} from "@/lib/growth/conversational-playbooks/conversational-playbook-types"

export { CONVERSATIONAL_PLAYBOOK_CONFIRM }

export const CONVERSATIONAL_PLAYBOOK_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "Playbooks compose GS-3A–3C knowledge assets — no duplicate stores.",
  "Conversational playbooks are coaching guidance only — no message send or auto-reply.",
  "All playbook outputs require human review before any outbound action.",
  "Audit events persist to growth.signal_events only.",
] as const

export function assertConversationalPlaybookExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export function buildConversationalPlaybookReadinessPayload() {
  return {
    qa_marker: CONVERSATIONAL_PLAYBOOK_QA_MARKER,
    execute_confirm: CONVERSATIONAL_PLAYBOOK_CONFIRM,
    allowed_actions: CONVERSATIONAL_PLAYBOOK_ACTIONS,
    no_message_send: true,
    no_auto_reply: true,
    no_campaign_launch: true,
    no_enrollment_execution: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    checklist: CONVERSATIONAL_PLAYBOOK_READINESS_CHECKLIST,
  }
}
