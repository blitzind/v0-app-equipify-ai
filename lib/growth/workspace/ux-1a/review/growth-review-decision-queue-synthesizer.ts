/** GE-AIOS-UX-1A Phase 3 — Review Human Decision Queue synthesizer (client-safe). */

import type { GrowthAvaCompletedWorkItem } from "@/lib/growth/aios/approvals/ava-completed-work-projection"
import { resolveCompletedWorkOperatorBucket } from "@/lib/growth/aios/approvals/completed-work-operator-ux"
import { formatGrowthCustomerApprovalActionLabel } from "@/lib/growth/customer-experience/growth-zero-assistance-adoption-19c-4a"
import type { GrowthSequenceExecutionJobView } from "@/lib/growth/sequences/execution/sequence-execution-types"
import { channelTypeLabel } from "@/lib/growth/multichannel/multichannel-types"
import {
  buildGrowthReviewPackageHref,
  buildGrowthReviewSendHref,
  GROWTH_REVIEW_QA_MARKER,
} from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"
import type {
  GrowthReviewDecisionQueueViewModel,
  ReviewDecisionItem,
  ReviewDecisionStatus,
} from "@/lib/growth/workspace/ux-1a/review/growth-review-decision-queue-types"

export const GROWTH_REVIEW_FORBIDDEN_OPERATOR_TERMS = [
  "AI OS",
  "Apollo",
  "enrollment",
  "execution job",
  "canonical decision",
  "transport gate",
  "Human Approval Center",
  "Sequence Execution",
  "Completed Work",
] as const

export function mapReviewSendStatusLabel(status: GrowthSequenceExecutionJobView["status"]): string {
  if (status === "pending_approval" || status === "draft") return "Ready for review"
  if (status === "approved" || status === "scheduled") return "Queued"
  if (status === "sent") return "Delivered"
  if (status === "failed" || status === "blocked") return "Needs attention"
  if (status === "skipped") return "Skipped"
  return "Ready for review"
}

export function mapReviewPackageStatusLabel(input: {
  blocked?: boolean
  completed?: boolean
}): { status: ReviewDecisionStatus; label: string } {
  if (input.completed) return { status: "completed", label: "Authorized" }
  if (input.blocked) return { status: "blocked", label: "Needs attention" }
  return { status: "ready_for_review", label: "Ready for review" }
}

function formatReviewTimestamp(value: string | null | undefined): string {
  if (!value) return "Recently prepared"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Recently prepared"
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export function projectReviewPackageDecisionItems(
  items: GrowthAvaCompletedWorkItem[],
): ReviewDecisionItem[] {
  return items
    .filter((row) => row.outreachCard && row.category === "outreach_packages")
    .map((row) => {
      const card = row.outreachCard!
      const bucket = resolveCompletedWorkOperatorBucket(row.item)
      const blocked = bucket === "ready_needs_revision" || row.item.status === "blocked"
      const statusMeta = mapReviewPackageStatusLabel({ blocked })
      const itemType = formatGrowthCustomerApprovalActionLabel(row.item.actionType)

      return {
        id: `package:${card.packageId}`,
        kind: "package" as const,
        title: card.company,
        companyName: card.company,
        summary: `${itemType} · ${card.whySelected || "Prepared for your review"}`,
        status: statusMeta.status,
        statusLabel: statusMeta.label,
        createdAt: card.timePrepared,
        href: buildGrowthReviewPackageHref(card.packageId),
        drawerTarget: {
          kind: "package" as const,
          packageId: card.packageId,
          leadId: card.leadId,
          itemId: card.itemId,
        },
        primaryAction: {
          id: "review-package",
          label: "Review",
          intent: "open" as const,
        },
        secondaryActions: [
          { id: "authorize-package", label: "Authorize", intent: "authorize" as const },
          { id: "needs-work-package", label: "Needs work", intent: "needs_work" as const },
        ],
        confidencePercent: Number.isFinite(card.confidence) ? Math.round(card.confidence) : null,
        channelLabel: card.recommendedChannel || null,
      }
    })
}

export function projectReviewSendDecisionItems(jobs: GrowthSequenceExecutionJobView[]): ReviewDecisionItem[] {
  return jobs
    .filter((job) => job.status === "pending_approval")
    .map((job) => {
      const blocked = Boolean(job.apolloDraftApprovalBlocked) || job.status === "blocked"
      const statusMeta = mapReviewPackageStatusLabel({ blocked })
      const preview =
        job.channel === "sms" && job.smsDraftBody?.trim()
          ? job.smsDraftBody.trim().slice(0, 120)
          : job.stepLabel

      return {
        id: `send:${job.id}`,
        kind: "send" as const,
        title: job.leadLabel,
        companyName: job.leadLabel,
        summary: preview || "Message prepared for your review",
        status: blocked ? "blocked" : statusMeta.status,
        statusLabel: blocked ? "Needs attention" : mapReviewSendStatusLabel(job.status),
        createdAt: job.createdAt,
        href: buildGrowthReviewSendHref(job.id),
        drawerTarget: {
          kind: "send" as const,
          jobId: job.id,
        },
        primaryAction: {
          id: "review-send",
          label: "Review send",
          intent: "open" as const,
        },
        secondaryActions: [
          { id: "authorize-send", label: "Authorize", intent: "approve_send" as const },
          { id: "skip-send", label: "Needs work", intent: "skip_send" as const },
        ],
        channelLabel: channelTypeLabel(job.channel),
      }
    })
}

export function synthesizeGrowthReviewDecisionQueue(input: {
  packageItems: GrowthAvaCompletedWorkItem[]
  sendJobs: GrowthSequenceExecutionJobView[]
}): GrowthReviewDecisionQueueViewModel {
  const packages = projectReviewPackageDecisionItems(input.packageItems)
  const sends = projectReviewSendDecisionItems(input.sendJobs)
  const packageCount = packages.filter((row) => row.status !== "completed").length
  const sendCount = sends.filter((row) => row.status !== "completed").length

  return {
    qaMarker: GROWTH_REVIEW_QA_MARKER,
    packages,
    sends,
    packageCount,
    sendCount,
    totalActionable: packageCount + sendCount,
    isCaughtUp: packageCount + sendCount === 0,
  }
}

export function findReviewDecisionItem(
  queue: GrowthReviewDecisionQueueViewModel,
  input: { tab: "packages" | "sends"; itemId: string | null },
): ReviewDecisionItem | null {
  if (!input.itemId) return null
  const list = input.tab === "sends" ? queue.sends : queue.packages
  return (
    list.find((row) =>
      input.tab === "sends"
        ? row.drawerTarget.kind === "send" && row.drawerTarget.jobId === input.itemId
        : row.drawerTarget.kind === "package" && row.drawerTarget.packageId === input.itemId,
    ) ?? null
  )
}

export function containsReviewForbiddenOperatorTerm(text: string): boolean {
  const haystack = text.toLowerCase()
  return GROWTH_REVIEW_FORBIDDEN_OPERATOR_TERMS.some((term) => haystack.includes(term.toLowerCase()))
}
