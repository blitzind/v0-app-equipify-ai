import "server-only"

export type MobilePayrollApprovalStatus = "pending" | "approved" | "disputed" | "rejected" | "archived"

export function nextPayrollApprovalStatus(
  from: MobilePayrollApprovalStatus,
  action: "approve" | "reject" | "dispute",
  actor: "manager" | "technician",
): MobilePayrollApprovalStatus | null {
  if (from !== "pending") return null
  if (actor === "technician") {
    if (action === "dispute") return "disputed"
    return null
  }
  if (action === "approve") return "approved"
  if (action === "reject") return "rejected"
  if (action === "dispute") return "disputed"
  return null
}

/** Advisory 0–100 queue pressure from pending count (bounded). */
export function mobilePayrollApprovalPressure0to100(pendingCount: number): number {
  const n = Math.max(0, Math.round(pendingCount))
  return Math.min(100, n * 7)
}
