"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { adminInvoices } from "@/lib/mock-data"
import type { AdminInvoice, InvoiceStatus } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerLineItems, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import { CheckCircle2, Download, DollarSign, AlertTriangle } from "lucide-react"

let toastCounter = 0

const STATUS_CONFIG: Record<InvoiceStatus, { className: string }> = {
  "Draft":   { className: "bg-muted text-muted-foreground border-border" },
  "Sent":    { className: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30" },
  "Unpaid":  { className: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30" },
  "Paid":    { className: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30" },
  "Overdue": { className: "bg-destructive/10 text-destructive border-destructive/30" },
  "Void":    { className: "bg-muted text-muted-foreground/60 border-border" },
}

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

interface InvoiceDrawerProps {
  invoiceId: string | null
  onClose: () => void
}

export function InvoiceDrawer({ invoiceId, onClose }: InvoiceDrawerProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const invoice = invoiceId ? adminInvoices.find((i) => i.id === invoiceId) ?? null : null

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  if (!invoice) return null

  const timelineItems = [
    { date: fmtDate(invoice.issueDate), label: "Invoice issued", accent: "muted" as const },
    { date: fmtDate(invoice.dueDate), label: `Payment due`, accent: (invoice.status === "Overdue" ? "danger" : "muted") as "danger" | "muted" },
    ...(invoice.paidDate ? [{ date: fmtDate(invoice.paidDate), label: "Payment received", description: fmtCurrency(invoice.amount), accent: "success" as const }] : []),
  ]

  return (
    <>
      <DetailDrawer
        open={!!invoiceId}
        onClose={onClose}
        title={invoice.id}
        subtitle={`${invoice.customerName} · ${invoice.equipmentName}`}
        width="lg"
        badge={
          <Badge variant="outline" className={cn("text-[10px] font-semibold", STATUS_CONFIG[invoice.status].className)}>
            {invoice.status}
          </Badge>
        }
        actions={
          <>
            {(invoice.status === "Unpaid" || invoice.status === "Overdue" || invoice.status === "Sent") && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast("Payment recorded successfully")}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Record Payment
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast("Invoice PDF downloaded")}>
              <Download className="w-3.5 h-3.5" /> Download PDF
            </Button>
          </>
        }
      >
        {/* Overdue banner */}
        {invoice.status === "Overdue" && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Payment overdue since {fmtDate(invoice.dueDate)}
          </div>
        )}

        {/* Summary */}
        <DrawerSection title="Invoice Details">
          <DrawerRow label="Customer" value={invoice.customerName} />
          <DrawerRow label="Equipment" value={invoice.equipmentName} />
          {invoice.workOrderId && <DrawerRow label="Work Order" value={<span className="text-primary font-mono">{invoice.workOrderId}</span>} />}
          <DrawerRow label="Issued" value={fmtDate(invoice.issueDate)} />
          <DrawerRow
            label="Due"
            value={<span className={invoice.status === "Overdue" ? "text-destructive font-semibold" : ""}>{fmtDate(invoice.dueDate)}</span>}
          />
          {invoice.paidDate && <DrawerRow label="Paid On" value={<span className="text-[color:var(--status-success)] font-semibold">{fmtDate(invoice.paidDate)}</span>} />}
        </DrawerSection>

        {/* Amount */}
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Invoice Total</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{fmtCurrency(invoice.amount)}</p>
          </div>
          <DollarSign className="w-8 h-8 text-primary/30" />
        </div>

        {/* Line items */}
        <DrawerSection title="Line Items">
          <DrawerLineItems items={invoice.lineItems} total={invoice.amount} />
        </DrawerSection>

        {/* Notes */}
        {invoice.notes && (
          <DrawerSection title="Notes">
            <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
              {invoice.notes}
            </p>
          </DrawerSection>
        )}

        {/* Timeline */}
        <DrawerSection title="Payment History">
          <DrawerTimeline items={timelineItems} />
        </DrawerSection>
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
