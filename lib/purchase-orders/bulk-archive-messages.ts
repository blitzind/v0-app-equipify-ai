/** User-facing copy for bulk purchase order archive results. */

export function purchaseOrderAlreadyArchivedMessage(archivedAt: string | null | undefined): string | null {
  return archivedAt ? "This purchase order is already archived." : null
}

export function bulkPurchaseOrderArchiveSuccessToast(successCount: number): string {
  return successCount === 1 ? "Purchase order archived" : "Purchase orders archived"
}

export function bulkPurchaseOrderArchivePartialToast(
  successCount: number,
  failureCount: number,
): string {
  const archived =
    successCount === 1 ? "1 purchase order archived" : `${successCount} purchase orders archived`
  const failed =
    failureCount === 1 ? "1 could not be archived" : `${failureCount} could not be archived`
  return `${archived}. ${failed}.`
}

export const BULK_PURCHASE_ORDER_ARCHIVE_PARTIAL_DESCRIPTION =
  "Purchase orders that could not be archived remain selected. Try again or archive them individually."
