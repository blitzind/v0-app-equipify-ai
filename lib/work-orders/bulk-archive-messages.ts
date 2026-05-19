/** User-facing copy for bulk work order archive results. */

export function bulkArchiveSuccessToast(successCount: number): string {
  return successCount === 1 ? "Work order archived" : "Work orders archived"
}

export function bulkArchivePartialToast(successCount: number, failureCount: number): string {
  const archived =
    successCount === 1 ? "1 work order archived" : `${successCount} work orders archived`
  const failed =
    failureCount === 1 ? "1 could not be archived" : `${failureCount} could not be archived`
  return `${archived}. ${failed}.`
}

export const BULK_ARCHIVE_PARTIAL_DESCRIPTION =
  "Items that could not be archived remain selected. Try again or archive them individually."
