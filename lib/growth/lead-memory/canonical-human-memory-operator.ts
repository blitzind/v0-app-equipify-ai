/** GE-AIOS-MEMORY-RESOLVER-1A/1B — Operator memory review re-exports. */

export {
  applyOperatorMemoryReviewDecision,
  type OperatorMemoryReviewAction,
  type OperatorMemoryReviewResult,
  type OperatorMemoryReviewResultCode,
} from "@/lib/growth/lead-memory/operator-memory-review-service"

export type OperatorMemoryReviewRow = import("@/lib/growth/aios/approvals/approvals-operator-review-packet").Approvals2AMemoryReviewRow

export { projectCanonicalMemoryReviewRows as projectOperatorMemoryReviewRows } from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
