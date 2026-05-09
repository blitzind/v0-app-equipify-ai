import type { ServiceRequestStatus } from "@/lib/service-requests/types"

/** Customer-safe labels — never expose internal workflow names on the portal. */
export function portalDisplayStatus(status: ServiceRequestStatus): string {
  switch (status) {
    case "new":
    case "reviewing":
    case "approved":
      return "Received"
    case "needs_info":
      return "More information needed"
    case "converted":
      return "Completed"
    case "declined":
    case "archived":
      return "Closed"
    default:
      return "Received"
  }
}
