/**
 * Shared types for draft customer message (client + server safe — no server-only).
 */

export type DraftCustomerMessageScenario =
  | "invoice"
  | "payment_link"
  | "work_order_completion"
  | "overdue_invoice"
  | "maintenance_reminder"
  | "quote_follow_up"
  | "customer_follow_up"

export type DraftCustomerMessagePreviewPayload = {
  scenario: DraftCustomerMessageScenario
  customer: { id: string; companyName: string }
  recordSummary: string
  amountLine: string | null
  statusLine: string | null
  dateLine: string | null
  paymentLinkUrl: string | null
  subject: string
  body: string
  relatedEntityType: "invoice" | "quote" | "work_order" | "equipment" | "customer" | null
  relatedEntityId: string | null
  warnings: string[]
}
