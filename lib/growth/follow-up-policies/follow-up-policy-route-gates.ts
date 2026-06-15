/** Phase GS-5C — Smart Follow-Up Policy route gates (client-safe). */

import {
  SMART_FOLLOW_UP_ACTIONS,
  SMART_FOLLOW_UP_POLICY_CONFIRM,
  SMART_FOLLOW_UP_POLICY_QA_MARKER,
} from "@/lib/growth/follow-up-policies/follow-up-policy-types"

export { SMART_FOLLOW_UP_POLICY_CONFIRM }

export const SMART_FOLLOW_UP_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "Follow-up policies reuse GS-1E inbox, GS-3E interventions, and GS-2E readiness — no duplicate stores.",
  "Smart follow-up engine is recommendation and planning only — no outreach or autonomous execution.",
  "All follow-up recommendations require explicit operator review before any downstream action.",
  "Audit events persist to growth.signal_events only.",
] as const

export function assertSmartFollowUpPolicyExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export function buildSmartFollowUpPolicyReadinessPayload() {
  return {
    qa_marker: SMART_FOLLOW_UP_POLICY_QA_MARKER,
    execute_confirm: SMART_FOLLOW_UP_POLICY_CONFIRM,
    allowed_actions: SMART_FOLLOW_UP_ACTIONS,
    no_outreach_execution: true,
    no_enrollment_execution: true,
    no_auto_reply: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    checklist: SMART_FOLLOW_UP_READINESS_CHECKLIST,
  }
}
