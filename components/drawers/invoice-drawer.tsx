"use client"

import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { useInvoices } from "@/lib/quote-invoice-store"
import { INVOICE_STATUS_BADGE_CLASSNAME } from "@/lib/invoices/invoice-status-badge-classes"
import { Badge } from "@/components/ui/badge"
import { DetailDrawer } from "@/components/detail-drawer"
import { InvoiceDetailView } from "@/components/drawers/invoice-detail-view"

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
          <Badge variant="outline" className={cn("text-[10px] font-semibold", INVOICE_STATUS_BADGE_CLASSNAME[invoice.status])}>
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
