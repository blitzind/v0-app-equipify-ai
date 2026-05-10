/**
 * Phase 37 — quote approval workflow helpers (staff + portal).
 * Reuses existing org_quotes.status values; additive DB columns optional.
 */

import type { QuoteStatus } from "@/lib/mock-data"

/** DB statuses where the customer may approve or decline in the portal. */
export const PORTAL_QUOTE_CUSTOMER_ACTIONABLE_DB = ["sent", "pending_approval"] as const

export type PortalQuoteCustomerActionableDb = (typeof PORTAL_QUOTE_CUSTOMER_ACTIONABLE_DB)[number]

export function isPortalQuoteCustomerActionableDb(status: string): boolean {
  return status === "sent" || status === "pending_approval"
}

/** Staff UI: quote is waiting on a customer decision (email sent / flagged). */
export function quoteUiAwaitingCustomerDecision(status: QuoteStatus): boolean {
  return status === "Sent" || status === "Pending Approval"
}

/** YYYY-MM-DD compare (UTC date strings). */
export function quotePastExpirationYmd(expiresAt: string | null | undefined, todayYmd: string): boolean {
  const head = expiresAt?.trim().slice(0, 10)
  if (!head || head.length < 10) return false
  return head < todayYmd.slice(0, 10)
}

/** Customer-facing status line on the portal (clearer than raw DB enums). */
export function mapQuoteStatusForPortal(db: string): string {
  switch (db) {
    case "draft":
      return "Draft"
    case "sent":
      return "Awaiting your review"
    case "pending_approval":
      return "Awaiting your approval"
    case "approved":
      return "Approved"
    case "declined":
      return "Declined"
    case "expired":
      return "Expired"
    default:
      return db.replace(/_/g, " ")
  }
}
