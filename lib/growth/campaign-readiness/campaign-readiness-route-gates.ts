/** Phase GS-2E — Campaign Readiness route gates (client-safe). */

import {
  CAMPAIGN_READINESS_ACTIONS,
  CAMPAIGN_READINESS_CONFIRM,
  CAMPAIGN_READINESS_QA_MARKER,
} from "@/lib/growth/campaign-readiness/campaign-readiness-types"

export { CAMPAIGN_READINESS_CONFIRM }

export const CAMPAIGN_READINESS_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "Assessment composes GS-2A–2D discovery, intelligence, and execution readiness — no duplicate stores.",
  "Campaign readiness is advisory only — no outreach, enrollment, or autonomous execution.",
  "All assessments require human review before any downstream campaign action.",
  "Audit events persist to growth.signal_events only.",
] as const

export function assertCampaignReadinessExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export function buildCampaignReadinessReadinessPayload() {
  return {
    qa_marker: CAMPAIGN_READINESS_QA_MARKER,
    execute_confirm: CAMPAIGN_READINESS_CONFIRM,
    allowed_actions: CAMPAIGN_READINESS_ACTIONS,
    no_outreach_execution: true,
    no_enrollment_execution: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    checklist: CAMPAIGN_READINESS_READINESS_CHECKLIST,
  }
}
