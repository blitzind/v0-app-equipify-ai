export type TechnicianBulkDeactivateEligibilityInput = {
  targetUserId: string
  actorUserId: string
  targetRole: string
  targetStatus: string
  actorIsOwner: boolean
  actorIsAdmin: boolean
  activeOwnerCount: number
}

export function technicianBulkDeactivateBlockMessage(
  input: TechnicianBulkDeactivateEligibilityInput,
): string | null {
  if (input.targetUserId === input.actorUserId) {
    return "You cannot deactivate your own account."
  }

  if (input.targetStatus === "suspended") {
    return "This technician is already deactivated."
  }

  if (input.actorIsAdmin && !input.actorIsOwner && input.targetRole === "owner") {
    return "Admins cannot deactivate owners."
  }

  const targetIsActiveOwner = input.targetRole === "owner" && input.targetStatus === "active"
  if (targetIsActiveOwner && input.activeOwnerCount <= 1) {
    return "Cannot deactivate the last owner."
  }

  return null
}

export function isTechnicianBulkDeactivateEligible(
  input: TechnicianBulkDeactivateEligibilityInput,
): boolean {
  return technicianBulkDeactivateBlockMessage(input) === null
}
