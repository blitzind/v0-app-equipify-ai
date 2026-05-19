/** User-facing copy for bulk customer archive results. */

export function customerAlreadyArchivedMessage(archivedAt: string | null | undefined): string | null {
  return archivedAt ? "This customer is already archived." : null
}

export function bulkCustomerArchiveSuccessToast(successCount: number): string {
  return successCount === 1 ? "Customer archived" : "Customers archived"
}

export function bulkCustomerArchivePartialToast(successCount: number, failureCount: number): string {
  const archived =
    successCount === 1 ? "1 customer archived" : `${successCount} customers archived`
  const failed =
    failureCount === 1 ? "1 could not be archived" : `${failureCount} could not be archived`
  return `${archived}. ${failed}.`
}

export const BULK_CUSTOMER_ARCHIVE_PARTIAL_DESCRIPTION =
  "Customers that could not be archived remain selected. Try again or archive them individually."
