import type { InvoiceStatus } from "@/lib/mock-data"

/**
 * Shared outline badge classes for invoice status (list, drawer header, detail view).
 * The invoices list adds extra styling for Void (e.g. line-through) at the call site.
 */
export const INVOICE_STATUS_BADGE_CLASSNAME: Record<InvoiceStatus, string> = {
  Draft: "bg-muted text-muted-foreground border-border",
  Sent: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30",
  Unpaid: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  Paid: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  Overdue: "bg-destructive/10 text-destructive border-destructive/30",
  Void: "bg-muted text-muted-foreground/60 border-border",
}
