/** User-facing copy for bulk prospect archive results. */

export function prospectAlreadyArchivedMessage(archivedAt: string | null | undefined): string | null {
  return archivedAt ? "This prospect is already archived." : null
}

export function bulkProspectArchiveSuccessToast(successCount: number): string {
  return successCount === 1 ? "Prospect archived" : "Prospects archived"
}

export function bulkProspectArchivePartialToast(successCount: number, failureCount: number): string {
  const archived =
    successCount === 1 ? "1 prospect archived" : `${successCount} prospects archived`
  const failed =
    failureCount === 1 ? "1 could not be archived" : `${failureCount} could not be archived`
  return `${archived}. ${failed}.`
}

export const BULK_PROSPECT_ARCHIVE_PARTIAL_DESCRIPTION =
  "Prospects that could not be archived remain selected. Try again or archive them individually."
