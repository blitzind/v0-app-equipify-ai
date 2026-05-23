/** Client-safe Growth Engine next-best-action types. */

export const GROWTH_NEXT_BEST_ACTIONS = [
  "wait_follow_up",
  "run_research",
  "refresh_research",
  "fix_website_research",
  "find_decision_maker",
  "call_primary_contact",
  "call_decision_maker",
  "retry_call",
  "review_disqualified",
  "manual_review",
] as const

export type GrowthNextBestAction = (typeof GROWTH_NEXT_BEST_ACTIONS)[number]

export const GROWTH_NEXT_BEST_ACTION_LABELS: Record<GrowthNextBestAction, string> = {
  wait_follow_up: "Wait for follow-up",
  run_research: "Run research",
  refresh_research: "Refresh research",
  fix_website_research: "Fix website research",
  find_decision_maker: "Find decision maker",
  call_primary_contact: "Call primary contact",
  call_decision_maker: "Call decision maker",
  retry_call: "Retry call",
  review_disqualified: "Review disqualified",
  manual_review: "Manual review",
}

export type GrowthNextBestActionResult = {
  action: GrowthNextBestAction
  label: string
  reason: string
  blockers: string[]
  confidence: "high" | "medium" | "low"
  actionVersion: "v1"
}
