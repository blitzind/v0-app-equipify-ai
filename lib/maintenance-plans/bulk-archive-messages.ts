/** User-facing copy for bulk maintenance plan archive results. */

export function maintenancePlanAlreadyArchivedMessage(archivedAt: string | null | undefined): string | null {
  return archivedAt ? "This maintenance plan is already archived." : null
}

export function bulkMaintenancePlanArchiveSuccessToast(successCount: number): string {
  return successCount === 1 ? "Maintenance plan archived" : "Maintenance plans archived"
}

export function bulkMaintenancePlanArchivePartialToast(
  successCount: number,
  failureCount: number,
): string {
  const archived =
    successCount === 1 ? "1 maintenance plan archived" : `${successCount} maintenance plans archived`
  const failed =
    failureCount === 1 ? "1 could not be archived" : `${failureCount} could not be archived`
  return `${archived}. ${failed}.`
}

export const BULK_MAINTENANCE_PLAN_ARCHIVE_PARTIAL_DESCRIPTION =
  "Maintenance plans that could not be archived remain selected. Try again or archive them individually."
