import type { POStatus } from "@/lib/purchase-order-store"

export type PurchaseOrderBulkArchiveEligibilityInput = {
  status: POStatus | string
  archivedAt?: string | null
}

const BLOCKED_STATUSES = new Set<POStatus>(["Closed", "Received"])

export function purchaseOrderBulkArchiveBlockMessage(
  input: PurchaseOrderBulkArchiveEligibilityInput,
): string | null {
  if (input.archivedAt) {
    return "This purchase order is already archived."
  }

  const status = String(input.status ?? "").trim() as POStatus

  if (BLOCKED_STATUSES.has(status)) {
    return "Received or closed purchase orders cannot be bulk archived."
  }

  return null
}

export function isPurchaseOrderBulkArchiveEligible(
  input: PurchaseOrderBulkArchiveEligibilityInput,
): boolean {
  return purchaseOrderBulkArchiveBlockMessage(input) === null
}
