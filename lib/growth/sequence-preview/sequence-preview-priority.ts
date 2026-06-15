/** Phase GS-5B — Sequence preview prioritization (client-safe). */

import type {
  SequencePreview,
  SequencePreviewFilter,
  SequencePreviewStatus,
} from "@/lib/growth/sequence-preview/sequence-preview-types"

const STATUS_RANK: Record<SequencePreviewStatus, number> = {
  blocked: 4,
  needs_review: 3,
  ready_for_human_approval: 2,
  draft: 1,
}

const REVIEW_PENALTY: Record<SequencePreview["review_status"], number> = {
  pending: 0,
  reviewed: -20,
  dismissed: -100,
}

export function scoreSequencePreview(preview: SequencePreview): number {
  const statusScore = STATUS_RANK[preview.sequence_status] * 20
  const stepScore = Math.min(15, preview.step_count * 3)
  const riskPenalty = preview.risks.filter((r) => r.severity === "critical").length * 15
  const reviewPenalty = REVIEW_PENALTY[preview.review_status] ?? 0
  return preview.preview_score + statusScore + stepScore - riskPenalty + reviewPenalty
}

export function rankSequencePreviews(previews: SequencePreview[]): SequencePreview[] {
  return [...previews].sort((left, right) => {
    const scoreDiff = scoreSequencePreview(right) - scoreSequencePreview(left)
    if (scoreDiff !== 0) return scoreDiff
    return right.generated_at.localeCompare(left.generated_at)
  })
}

export function filterSequencePreviews(
  previews: SequencePreview[],
  filter: SequencePreviewFilter,
): SequencePreview[] {
  switch (filter) {
    case "blocked":
      return previews.filter((p) => p.sequence_status === "blocked")
    case "needs_review":
      return previews.filter((p) => p.sequence_status === "needs_review")
    case "ready":
      return previews.filter((p) => p.sequence_status === "ready_for_human_approval")
    default:
      return previews.filter((p) => p.review_status !== "dismissed")
  }
}
