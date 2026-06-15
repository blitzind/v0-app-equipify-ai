/** Phase GS-4C — Realtime Event Bus route gates (client-safe). */

import {
  REALTIME_EVENT_ACTIONS,
  REALTIME_EVENTS_CONFIRM,
  REALTIME_EVENTS_QA_MARKER,
} from "@/lib/growth/realtime-events/realtime-events-types"

export { REALTIME_EVENTS_CONFIRM }

export const REALTIME_EVENTS_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "Event bus reuses growth.signal_events only — no duplicate event store.",
  "Publish and routing are observability and UI refresh signals only — no outreach or autonomous execution.",
  "All realtime events require explicit operator review before downstream action.",
  "Safe polling fallback when Supabase realtime subscriptions are unavailable.",
] as const

export function assertRealtimeEventsExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export function buildRealtimeEventsReadinessPayload() {
  return {
    qa_marker: REALTIME_EVENTS_QA_MARKER,
    execute_confirm: REALTIME_EVENTS_CONFIRM,
    allowed_actions: REALTIME_EVENT_ACTIONS,
    no_outreach_execution: true,
    no_enrollment_execution: true,
    no_auto_reply: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    checklist: REALTIME_EVENTS_READINESS_CHECKLIST,
  }
}
