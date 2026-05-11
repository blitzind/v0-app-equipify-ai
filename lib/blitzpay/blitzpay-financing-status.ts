/**
 * Financing lifecycle labels — staff vs customer-safe wording (Phase 2O).
 * Equipify does not originate credit; statuses track external workflow only.
 */

export const BLITZPAY_FINANCING_SESSION_STATUSES = [
  "financing_available",
  "application_started",
  "submitted",
  "approved",
  "declined",
  "funded",
  "contractor_pending_completion",
  "payout_released",
  "canceled",
] as const

export type BlitzpayFinancingSessionStatus = (typeof BLITZPAY_FINANCING_SESSION_STATUSES)[number]

export function isBlitzpayFinancingSessionStatus(s: string): s is BlitzpayFinancingSessionStatus {
  return (BLITZPAY_FINANCING_SESSION_STATUSES as readonly string[]).includes(s)
}

/** Customer portal / PDF — no underwriting jargon. */
export function financingStatusCustomerLabel(status: string): string {
  switch (status) {
    case "financing_available":
      return "Financing may be available"
    case "application_started":
      return "Application in progress"
    case "submitted":
      return "Application submitted"
    case "approved":
      return "Approved"
    case "declined":
      return "Not approved"
    case "funded":
      return "Funded"
    case "contractor_pending_completion":
      return "Work in progress"
    case "payout_released":
      return "Completed"
    case "canceled":
      return "Canceled"
    default:
      return "In review"
  }
}

/** Staff-facing short label for tables. */
export function financingStatusStaffLabel(status: string): string {
  switch (status) {
    case "financing_available":
      return "Available"
    case "application_started":
      return "Application started"
    case "submitted":
      return "Submitted"
    case "approved":
      return "Approved"
    case "declined":
      return "Declined"
    case "funded":
      return "Funded"
    case "contractor_pending_completion":
      return "Pending completion"
    case "payout_released":
      return "Payout released"
    case "canceled":
      return "Canceled"
    default:
      return status.replace(/_/g, " ")
  }
}
