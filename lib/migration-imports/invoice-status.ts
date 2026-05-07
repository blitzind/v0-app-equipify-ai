/** Normalize free-text CSV invoice status to DB enum. */
export function csvInvoiceStatusToDb(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (!s) return "unpaid"
  if (["paid", "payment", "closed"].includes(s)) return "paid"
  if (["unpaid", "open", "balance"].includes(s)) return "unpaid"
  if (["overdue", "past_due", "past due"].includes(s)) return "overdue"
  if (["draft"].includes(s)) return "draft"
  if (["sent", "issued"].includes(s)) return "sent"
  if (["void", "cancelled", "canceled"].includes(s)) return "void"
  return "unpaid"
}
