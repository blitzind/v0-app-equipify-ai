"use client"

import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { useInvoices } from "@/lib/quote-invoice-store"
import type { InvoiceStatus } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { DetailDrawer } from "@/components/detail-drawer"
import { InvoiceDetailView } from "@/components/drawers/invoice-detail-view"

const STATUS_CONFIG: Record<InvoiceStatus, { className: string }> = {
  Draft:   { className: "bg-muted text-muted-foreground border-border" },
  Sent:    { className: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30" },
  Unpaid:  { className: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30" },
  Paid:    { className: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30" },
  Overdue: { className: "bg-destructive/10 text-destructive border-destructive/30" },
  Void:    { className: "bg-muted text-muted-foreground/60 border-border" },
}

interface InvoiceDrawerProps {
  invoiceId: string | null
  onClose: () => void
}

export function InvoiceDrawer({ invoiceId, onClose }: InvoiceDrawerProps) {
  const { invoices } = useInvoices()
  const invoice = invoiceId ? invoices.find((i) => i.id === invoiceId) ?? null : null

  // When invoiceId changes, scroll back to top on next open
  useEffect(() => {}, [invoiceId])

  return (
    <DetailDrawer
      open={!!invoiceId}
      onClose={onClose}
      title={invoice ? invoice.invoiceNumber?.trim() || "Invoice" : "Invoice"}
      subtitle={
        invoice
          ? `${invoice.customerName} · ${invoice.equipmentName}${
              invoice.sentAt
                ? ` · Sent on ${new Date(invoice.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : ""
            }`
          : undefined
      }
      width="2xl"
      noScroll
      badge={
        invoice ? (
          <Badge variant="outline" className={cn("text-[10px] font-semibold", STATUS_CONFIG[invoice.status].className)}>
            {invoice.status}
          </Badge>
        ) : undefined
      }
    >
      {invoice && (
        <InvoiceDetailView
          invoice={invoice}
          onClose={onClose}
        />
      )}
    </DetailDrawer>
  )
}
