import type { GrowthLeadCallDisposition } from "@/lib/growth/call-types"
import { hasUsableResearch } from "@/lib/growth/call-priority"
import type { GrowthDecisionMakerPresenceStatus } from "@/lib/growth/decision-maker-types"
import type { GrowthLeadAgingBucket } from "@/lib/growth/lead-aging"
import type { GrowthNextBestAction } from "@/lib/growth/nba-types"
import type { GrowthWorkflowHealthResult, GrowthWorkflowHealthStatus } from "@/lib/growth/workflow-health-types"
import type { GrowthLeadStatus } from "@/lib/growth/types"

export type WorkflowHealthInput = {
  status: GrowthLeadStatus
  score: number | null
  contactPhone: string | null
  primaryDecisionMakerPhone: string | null
  decisionMakerStatus: GrowthDecisionMakerPresenceStatus | null
  lastResearchedAt: string | null
  latestResearchRunId: string | null
  lastHumanTouchAt: string | null
  followUpAt: string | null
  websiteFetchStatus: string | null
  website: string | null
  nextBestAction: GrowthNextBestAction | null
  agingBucket: GrowthLeadAgingBucket | null
  voicemailCount45d: number
  now?: Date
}

const TERMINAL_STATUSES = new Set<GrowthLeadStatus>(["converted", "disqualified", "archived"])
const FAILED_WEBSITE_STATUSES = new Set(["blocked", "timeout", "error", "invalid_url", "too_large"])
const NEEDS_ATTENTION_NBA = new Set<GrowthNextBestAction>([
  "fix_website_research",
  "find_decision_maker",
  "refresh_research",
])

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)
}

function hasCallablePhone(input: WorkflowHealthInput): boolean {
  return Boolean(input.contactPhone?.trim() || input.primaryDecisionMakerPhone?.trim())
}

function build(status: GrowthWorkflowHealthStatus, reason: string): GrowthWorkflowHealthResult {
  return { status, reason }
}

export function computeGrowthLeadWorkflowHealth(input: WorkflowHealthInput): GrowthWorkflowHealthResult {
  const now = input.now ?? new Date()
  const fit = input.score ?? 0

  if (TERMINAL_STATUSES.has(input.status)) {
    return build("healthy", "Terminal lead — workflow complete.")
  }

  const touchDays = daysSince(input.lastHumanTouchAt, now)
  const researchDays = daysSince(input.lastResearchedAt, now)
  const websiteStatus = input.websiteFetchStatus ?? "skipped"
  const usableResearch = hasUsableResearch(input.lastResearchedAt, input.latestResearchRunId)

  if (
    fit > 75 &&
    input.agingBucket === "critical" &&
    touchDays != null &&
    touchDays > 30
  ) {
    return build(
      "stalled",
      "High-fit lead in critical aging with no human touch in over 30 days.",
    )
  }

  if (websiteStatus === "blocked" && fit <= 80 && !hasCallablePhone(input)) {
    return build("blocked", "Website fetch blocked and no callable contact.")
  }

  if (!usableResearch && !["new", "researching"].includes(input.status)) {
    return build("blocked", "Pipeline status expects research but none is usable.")
  }

  if (input.followUpAt && !Number.isNaN(new Date(input.followUpAt).getTime())) {
    const overdueDays = (now.getTime() - new Date(input.followUpAt).getTime()) / (24 * 60 * 60 * 1000)
    if (overdueDays > 7 && (touchDays == null || touchDays > overdueDays)) {
      return build("blocked", "Follow-up overdue by more than 7 days.")
    }
  }

  if (touchDays != null && touchDays >= 21) {
    return build("stalled", "No human touch in 21 or more days.")
  }

  if (researchDays != null && researchDays > 90) {
    return build("stalled", "Research is more than 90 days old.")
  }

  if (input.voicemailCount45d >= 3 && input.status !== "qualified" && input.status !== "call_ready") {
    return build("stalled", "Multiple voicemails without pipeline progress.")
  }

  if (!hasCallablePhone(input)) {
    return build("needs_attention", "Missing callable phone on lead and decision maker.")
  }

  if (
    (input.decisionMakerStatus === "none" || input.decisionMakerStatus === "suspected") &&
    fit >= 60
  ) {
    return build("needs_attention", "High-fit lead without confirmed decision maker.")
  }

  if (
    input.website?.trim() &&
    FAILED_WEBSITE_STATUSES.has(websiteStatus) &&
    websiteStatus !== "blocked"
  ) {
    return build("needs_attention", "Website fetch failed — retry research.")
  }

  if (input.followUpAt && !Number.isNaN(new Date(input.followUpAt).getTime())) {
    const dueInDays = (new Date(input.followUpAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    if (dueInDays <= 3 && dueInDays >= -7) {
      return build("needs_attention", "Follow-up due soon or recently passed.")
    }
  }

  if (input.nextBestAction && NEEDS_ATTENTION_NBA.has(input.nextBestAction)) {
    return build("needs_attention", "Next best action requires enrichment or fixes.")
  }

  return build("healthy", "Workflow signals look current.")
}
