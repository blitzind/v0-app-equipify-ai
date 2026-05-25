import type { HumanExecutionApprovalStatus } from "@/lib/growth/human-execution/human-execution-types"

const VALID_TRANSITIONS: Record<HumanExecutionApprovalStatus, HumanExecutionApprovalStatus[]> = {
  draft: ["review", "cancelled"],
  review: ["approved", "draft", "cancelled"],
  approved: ["executed", "cancelled"],
  executed: ["complete"],
  complete: [],
  cancelled: [],
}

export function canTransitionHumanExecutionApproval(
  from: HumanExecutionApprovalStatus,
  to: HumanExecutionApprovalStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function assertHumanExecutionApprovalTransition(
  from: HumanExecutionApprovalStatus,
  to: HumanExecutionApprovalStatus,
): void {
  if (!canTransitionHumanExecutionApproval(from, to)) {
    throw new Error(`Invalid approval transition: ${from} → ${to}`)
  }
}

export function humanExecutionApprovalNextActions(
  status: HumanExecutionApprovalStatus,
): HumanExecutionApprovalStatus[] {
  return VALID_TRANSITIONS[status] ?? []
}

export function isHumanExecutionApprovalActionable(status: HumanExecutionApprovalStatus): boolean {
  return status === "draft" || status === "review" || status === "approved"
}

export function isHumanExecutionApprovalPending(status: HumanExecutionApprovalStatus): boolean {
  return status === "draft" || status === "review"
}

export function isHumanExecutionApprovalReady(status: HumanExecutionApprovalStatus): boolean {
  return status === "approved"
}
