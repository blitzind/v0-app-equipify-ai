/** User-facing copy for bulk invoice archive results. */

export function invoiceAlreadyArchivedMessage(archivedAt: string | null | undefined): string | null {
  return archivedAt ? "This invoice is already archived." : null
}

export function bulkInvoiceArchiveSuccessToast(successCount: number): string {
  return successCount === 1 ? "Invoice archived" : "Invoices archived"
}

export function bulkInvoiceArchivePartialToast(successCount: number, failureCount: number): string {
  const archived =
    successCount === 1 ? "1 invoice archived" : `${successCount} invoices archived`
  const failed =
    failureCount === 1 ? "1 could not be archived" : `${failureCount} could not be archived`
  return `${archived}. ${failed}.`
}

export const BULK_INVOICE_ARCHIVE_PARTIAL_DESCRIPTION =
  "Invoices that could not be archived remain selected. Try again or archive them individually."
