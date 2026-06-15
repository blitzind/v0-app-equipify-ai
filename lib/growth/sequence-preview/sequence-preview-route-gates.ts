/** Phase GS-5B — Sequence Preview route gates (client-safe). */

import {
  SEQUENCE_PREVIEW_ACTIONS,
  SEQUENCE_PREVIEW_CONFIRM,
  SEQUENCE_PREVIEW_QA_MARKER,
} from "@/lib/growth/sequence-preview/sequence-preview-types"

export { SEQUENCE_PREVIEW_CONFIRM }

export const SEQUENCE_PREVIEW_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "Sequence previews reuse patterns, readiness, interventions, and voice-drop gates — no duplicate stores.",
  "Sequence Preview Studio is preview and review only — no outreach or autonomous execution.",
  "All previews require explicit operator review before enrollment or send.",
  "Audit events persist to growth.signal_events only.",
] as const

export function assertSequencePreviewExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export function buildSequencePreviewReadinessPayload() {
  return {
    qa_marker: SEQUENCE_PREVIEW_QA_MARKER,
    execute_confirm: SEQUENCE_PREVIEW_CONFIRM,
    allowed_actions: SEQUENCE_PREVIEW_ACTIONS,
    no_outreach_execution: true,
    no_enrollment_execution: true,
    no_auto_reply: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    checklist: SEQUENCE_PREVIEW_READINESS_CHECKLIST,
  }
}
