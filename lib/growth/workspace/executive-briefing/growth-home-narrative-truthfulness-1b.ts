/**
 * GE-AIOS-HOME-NARRATIVE-TRUTHFULNESS-1B — Canonical Home narrative vocabulary guards.
 * Presentation-only: never redefines runtime or approval authority semantics.
 */

export const GROWTH_HOME_NARRATIVE_TRUTHFULNESS_1B_QA_MARKER =
  "ge-aios-home-narrative-truthfulness-1b-v1" as const

const OPERATOR_APPROVAL_NARRATIVE_PATTERN =
  /ready for your review|waiting for your review|need your approval|review package|packages are ready|outreach packages are ready|I need your review|awaiting your review/i

const MISLEADING_PACKAGE_READY_PATTERN =
  /outreach packages are ready|outreach package is ready|packages are ready for your review|packages need review|approvals waiting/i

/** Admission review backlog — portfolio.health.counts.awaitingReview (21C review state). */
export function formatAdmissionReviewBacklogSummary(count: number): string {
  if (count <= 0) return ""
  return count === 1
    ? "1 company requires admission review."
    : `${count} companies require admission review.`
}

/** Canonical discovery rationale when portfolio is below target. */
export function portfolioBelowTargetDiscoveryReasonPhrase(): string {
  return "our active portfolio is still below target"
}

/** Research-loop in-progress count — not operator approval queue. */
export function packagePreparationInProgressPhrase(count: number): string {
  if (count <= 0) return ""
  return count === 1
    ? "one supervised outreach package in preparation"
    : `${count} supervised outreach packages in preparation`
}

export function packagePreparationMilestonePhrase(count: number): string {
  if (count <= 0) {
    return "I'll continue qualifying companies until the next review-ready opportunity is available."
  }
  return count === 1
    ? "I'll let you know when that supervised outreach package is ready for your review."
    : "I'll let you know when those supervised outreach packages are ready for your review."
}

export function narrativeClaimsOperatorApprovalPending(text: string): boolean {
  return OPERATOR_APPROVAL_NARRATIVE_PATTERN.test(text)
}

/** Fail-safe: omit mission summary lines that misrepresent admission review or approval queue. */
export function sanitizeMissionSummaryLineForPresentation(
  line: string | null | undefined,
  pendingApprovalCount: number,
): string | null {
  const trimmed = line?.trim()
  if (!trimmed) return null
  if (MISLEADING_PACKAGE_READY_PATTERN.test(trimmed)) return null
  if (pendingApprovalCount <= 0 && narrativeClaimsOperatorApprovalPending(trimmed)) return null
  return trimmed
}

export function heroNarrativeMustNotClaimApprovalWhenPendingZero(
  narrative: string,
  pendingApprovalCount: number,
): boolean {
  if (pendingApprovalCount > 0) return true
  return !narrativeClaimsOperatorApprovalPending(narrative)
}
