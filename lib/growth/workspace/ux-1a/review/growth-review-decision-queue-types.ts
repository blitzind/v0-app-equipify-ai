/** GE-AIOS-UX-1A Phase 3 — Human Decision Queue presentation contract (client-safe). */

import { GROWTH_REVIEW_QA_MARKER } from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"

export { GROWTH_REVIEW_QA_MARKER }

export type ReviewDecisionKind = "package" | "send"

export type ReviewDecisionStatus = "ready_for_review" | "blocked" | "completed"

export type ReviewDrawerTarget =
  | {
      kind: "package"
      packageId: string
      leadId: string
      itemId: string
    }
  | {
      kind: "send"
      jobId: string
    }

export type ReviewActionIntent =
  | "open"
  | "authorize"
  | "needs_work"
  | "reject"
  | "approve_send"
  | "skip_send"

export type ReviewAction = {
  id: string
  label: string
  href?: string
  intent: ReviewActionIntent
}

export type ReviewDecisionItem = {
  id: string
  kind: ReviewDecisionKind
  title: string
  companyName?: string
  summary: string
  status: ReviewDecisionStatus
  statusLabel: string
  createdAt: string
  href?: string
  drawerTarget: ReviewDrawerTarget
  primaryAction: ReviewAction
  secondaryActions?: ReviewAction[]
  confidencePercent?: number | null
  channelLabel?: string | null
}

export type GrowthReviewDecisionQueueViewModel = {
  qaMarker: typeof GROWTH_REVIEW_QA_MARKER
  packages: ReviewDecisionItem[]
  sends: ReviewDecisionItem[]
  packageCount: number
  sendCount: number
  totalActionable: number
  isCaughtUp: boolean
}
