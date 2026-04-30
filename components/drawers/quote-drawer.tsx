"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { adminQuotes } from "@/lib/mock-data"
import type { AdminQuote, QuoteStatus } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DetailDrawer, DrawerSection, DrawerRow, DrawerLineItems, DrawerTimeline, DrawerToastStack,
  type ToastItem,
} from "@/components/detail-drawer"
import { CheckCircle2, FileText, ClipboardList, Download, Send } from "lucide-react"

let toastCounter = 0

const STATUS_CONFIG: Record<QuoteStatus, { className: string }> = {
  "Draft":            { className: "bg-muted text-muted-foreground border-border" },
  "Sent":             { className: "bg-[color:var(--status-info)]/10 text-[color:var(--status-info)] border-[color:var(--status-info)]/30" },
  "Pending Approval": { className: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30" },
  "Approved":         { className: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30" },
  "Declined":         { className: "bg-destructive/10 text-destructive border-destructive/30" },
  "Expired":          { className: "bg-muted text-muted-foreground border-border" },
}

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

interface QuoteDrawerProps {
  quoteId: string | null
  onClose: () => void
}

export function QuoteDrawer({ quoteId, onClose }: QuoteDrawerProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const quote = quoteId ? adminQuotes.find((q) => q.id === quoteId) ?? null : null

  function toast(message: string) {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, type: "success" }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500)
  }

  if (!quote) return null

  const timelineItems = [
    { date: fmtDate(quote.createdDate), label: "Quote created", description: `Created by ${quote.createdBy}`, accent: "muted" as const },
    ...(quote.sentDate ? [{ date: fmtDate(quote.sentDate), label: "Quote sent to customer", accent: "muted" as const }] : []),
    ...(quote.status === "Approved" ? [{ date: "—", label: "Customer approved quote", accent: "success" as const }] : []),
    ...(quote.status === "Declined" ? [{ date: "—", label: "Customer declined quote", accent: "danger" as const }] : []),
    ...(quote.status === "Expired" ? [{ date: fmtDate(quote.expiresDate), label: "Quote expired", accent: "danger" as const }] : []),
  ]

  return (
    <>
      <DetailDrawer
        open={!!quoteId}
        onClose={onClose}
        title={quote.id}
        subtitle={`${quote.customerName} · ${quote.equipmentName}`}
        width="lg"
        badge={
          <Badge variant="outline" className={cn("text-[10px] font-semibold", STATUS_CONFIG[quote.status].className)}>
            {quote.status}
          </Badge>
        }
        actions={
          <>
            {(quote.status === "Draft" || quote.status === "Sent") && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast("Quote sent to customer")}>
                <Send className="w-3.5 h-3.5" /> Send to Customer
              </Button>
            )}
            {quote.status === "Approved" && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast("Work order created from quote")}>
                <ClipboardList className="w-3.5 h-3.5" /> Convert to WO
              </Button>
            )}
            {quote.status === "Approved" && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast("Invoice created from quote")}>
                <FileText className="w-3.5 h-3.5" /> Convert to Invoice
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => toast("Quote PDF downloaded")}>
              <Download className="w-3.5 h-3.5" /> Download PDF
            </Button>
          </>
        }
      >
        {/* Summary */}
        <DrawerSection title="Quote Details">
          <DrawerRow label="Customer" value={quote.customerName} />
          <DrawerRow label="Equipment" value={quote.equipmentName} />
          <DrawerRow label="Created By" value={quote.createdBy} />
          <DrawerRow label="Created" value={fmtDate(quote.createdDate)} />
          <DrawerRow label="Expires" value={
            <span className={quote.status === "Expired" ? "text-destructive font-semibold" : ""}>{fmtDate(quote.expiresDate)}</span>
          } />
          {quote.workOrderId && <DrawerRow label="Work Order" value={<span className="text-primary font-mono">{quote.workOrderId}</span>} />}
        </DrawerSection>

        {/* Description */}
        <DrawerSection title="Description">
          <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
            {quote.description}
          </p>
        </DrawerSection>

        {/* Line items */}
        <DrawerSection title="Line Items">
          <DrawerLineItems items={quote.lineItems} total={quote.amount} />
        </DrawerSection>

        {/* Notes */}
        {quote.notes && (
          <DrawerSection title="Notes">
            <p className="text-xs text-muted-foreground leading-relaxed p-3 bg-muted/30 rounded-lg border border-border">
              {quote.notes}
            </p>
          </DrawerSection>
        )}

        {/* Timeline */}
        <DrawerSection title="Timeline">
          <DrawerTimeline items={timelineItems} />
        </DrawerSection>
      </DetailDrawer>

      <DrawerToastStack toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  )
}
