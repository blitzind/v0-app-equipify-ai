export type MaintenancePlanBulkArchiveEligibilityInput = {
  isArchived?: boolean
  archivedAt?: string | null
}

export function maintenancePlanBulkArchiveBlockMessage(
  input: MaintenancePlanBulkArchiveEligibilityInput,
): string | null {
  if (input.isArchived || input.archivedAt) {
    return "This maintenance plan is already archived."
  }
  return null
}

export function isMaintenancePlanBulkArchiveEligible(
  input: MaintenancePlanBulkArchiveEligibilityInput,
): boolean {
  return maintenancePlanBulkArchiveBlockMessage(input) === null
}
