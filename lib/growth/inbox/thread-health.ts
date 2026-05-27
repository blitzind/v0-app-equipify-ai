/** Deterministic inbox thread health evaluation. Client-safe. No AI. */

import type { GrowthInboxThread, GrowthInboxThreadStatus } from "@/lib/growth/inbox/inbox-types"

export type ThreadHealthEvaluation = {
  thread_status: GrowthInboxThreadStatus
  requires_human_review: boolean
  health_summary: string
}

export function evaluateThreadHealth(input: {
  classification: GrowthInboxThread["classification"]
  priority_tier: GrowthInboxThread["priority_tier"]
  current_status?: GrowthInboxThreadStatus
  has_owner?: boolean
}): ThreadHealthEvaluation {
  let thread_status: GrowthInboxThreadStatus = input.current_status ?? "open"
  let requires_human_review = true

  if (input.classification === "unsubscribe" || input.classification === "not_interested") {
    thread_status = "needs_review"
    requires_human_review = true
  } else if (input.priority_tier === "critical") {
    thread_status = thread_status === "resolved" || thread_status === "archived" ? thread_status : "needs_review"
    requires_human_review = true
  } else if (input.classification === "positive_interest" || input.classification === "meeting_intent") {
    thread_status = thread_status === "archived" ? "archived" : "open"
    requires_human_review = true
  } else if (input.classification === "unknown") {
    thread_status = thread_status === "resolved" || thread_status === "archived" ? thread_status : "waiting"
    requires_human_review = true
  }

  if (!input.has_owner && input.priority_tier !== "low") {
    requires_human_review = true
  }

  const health_summary =
    input.priority_tier === "critical"
      ? "Critical priority thread requires operator review."
      : requires_human_review
        ? "Human review required before any outbound action."
        : "Thread tracked with standard monitoring."

  return { thread_status, requires_human_review, health_summary }
}

export function threadStatusLabel(status: GrowthInboxThreadStatus): string {
  switch (status) {
    case "open":
      return "Open"
    case "waiting":
      return "Waiting"
    case "needs_review":
      return "Needs review"
    case "resolved":
      return "Resolved"
    case "archived":
      return "Archived"
  }
}
