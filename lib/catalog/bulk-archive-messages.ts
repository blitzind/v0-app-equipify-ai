/** User-facing copy for bulk catalog item archive results. */

export function catalogItemAlreadyArchivedMessage(archivedAt: string | null | undefined): string | null {
  return archivedAt ? "This catalog item is already archived." : null
}

export function bulkCatalogArchiveSuccessToast(successCount: number): string {
  return successCount === 1 ? "Catalog item archived" : "Catalog items archived"
}

export function bulkCatalogArchivePartialToast(successCount: number, failureCount: number): string {
  const archived =
    successCount === 1 ? "1 catalog item archived" : `${successCount} catalog items archived`
  const failed =
    failureCount === 1 ? "1 could not be archived" : `${failureCount} could not be archived`
  return `${archived}. ${failed}.`
}

export const BULK_CATALOG_ARCHIVE_PARTIAL_DESCRIPTION =
  "Items that could not be archived remain selected. Try again or archive them individually."
