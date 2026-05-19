/** User-facing copy for bulk quote archive results. */

export function quoteAlreadyArchivedMessage(archivedAt: string | null | undefined): string | null {
  return archivedAt ? "This quote is already archived." : null
}

export function bulkQuoteArchiveSuccessToast(successCount: number): string {
  return successCount === 1 ? "Quote archived" : "Quotes archived"
}

export function bulkQuoteArchivePartialToast(successCount: number, failureCount: number): string {
  const archived =
    successCount === 1 ? "1 quote archived" : `${successCount} quotes archived`
  const failed =
    failureCount === 1 ? "1 could not be archived" : `${failureCount} could not be archived`
  return `${archived}. ${failed}.`
}

export const BULK_QUOTE_ARCHIVE_PARTIAL_DESCRIPTION =
  "Quotes that could not be archived remain selected. Try again or archive them individually."
