/** User-facing copy for bulk vendor archive results. */

export function vendorAlreadyArchivedMessage(archivedAt: string | null | undefined): string | null {
  return archivedAt ? "This vendor is already archived." : null
}

export function bulkVendorArchiveSuccessToast(successCount: number): string {
  return successCount === 1 ? "Vendor archived" : "Vendors archived"
}

export function bulkVendorArchivePartialToast(successCount: number, failureCount: number): string {
  const archived =
    successCount === 1 ? "1 vendor archived" : `${successCount} vendors archived`
  const failed =
    failureCount === 1 ? "1 could not be archived" : `${failureCount} could not be archived`
  return `${archived}. ${failed}.`
}

export const BULK_VENDOR_ARCHIVE_PARTIAL_DESCRIPTION =
  "Vendors that could not be archived remain selected. Try again or archive them individually."
