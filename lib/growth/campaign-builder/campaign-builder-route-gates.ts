/** Phase GS-5D — Campaign Builder route gates (client-safe). */

import {
  CAMPAIGN_BUILDER_ACTIONS,
  CAMPAIGN_BUILDER_CONFIRM,
  CAMPAIGN_BUILDER_QA_MARKER,
} from "@/lib/growth/campaign-builder/campaign-builder-types"

export { CAMPAIGN_BUILDER_CONFIRM }

export const CAMPAIGN_BUILDER_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "Campaign wizard reuses readiness, previews, policies, interventions, and patterns — no duplicate stores.",
  "Campaign Builder Wizard is configuration and planning only — no outreach or autonomous execution.",
  "All wizard sessions require explicit operator review before any campaign action.",
  "Audit events persist to growth.signal_events only.",
] as const

export function assertCampaignBuilderExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export function buildCampaignBuilderReadinessPayload() {
  return {
    qa_marker: CAMPAIGN_BUILDER_QA_MARKER,
    execute_confirm: CAMPAIGN_BUILDER_CONFIRM,
    allowed_actions: CAMPAIGN_BUILDER_ACTIONS,
    no_outreach_execution: true,
    no_enrollment_execution: true,
    no_auto_reply: true,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    checklist: CAMPAIGN_BUILDER_READINESS_CHECKLIST,
  }
}
