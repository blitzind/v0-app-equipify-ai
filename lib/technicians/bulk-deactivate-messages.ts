/** User-facing copy for bulk technician deactivate results. */

export function technicianAlreadyDeactivatedMessage(status: string | null | undefined): string | null {
  return status === "suspended" ? "This technician is already deactivated." : null
}

export function bulkTechnicianDeactivateSuccessToast(successCount: number): string {
  return successCount === 1 ? "Technician deactivated" : "Technicians deactivated"
}

export function bulkTechnicianDeactivatePartialToast(
  successCount: number,
  failureCount: number,
): string {
  const deactivated =
    successCount === 1 ? "1 technician deactivated" : `${successCount} technicians deactivated`
  const failed =
    failureCount === 1 ? "1 could not be deactivated" : `${failureCount} could not be deactivated`
  return `${deactivated}. ${failed}.`
}

export const BULK_TECHNICIAN_DEACTIVATE_PARTIAL_DESCRIPTION =
  "Technicians that could not be deactivated remain selected. Try again or deactivate them individually from Team settings."
