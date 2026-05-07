"use client"

/**
 * Invoicing Phase 2 — Linked invoices summary for work order drawer.
 *
 * Compact, read-only summary of invoices linked to a work order. Renders
 * status pills (Paid / Unpaid / Overdue / Draft / Sent), aggregate amount,
 * and a "Pending sync" hint when QuickBooks integration is queued. No raw
 * UUIDs in UI — invoice numbers and currency only.
 */

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, Clock, FileText, Receipt } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AdminInvoice, InvoiceStatus } from "@/lib/mock-data"
import { invoiceTermsCodeLabel } from "@/lib/billing/invoice-terms"

const STATUS_TONE: Record<InvoiceStatus, string> = {
  Draft: "bg-secondary/40 text-foreground border-border",
  Sent: "bg-secondary/40 text-foreground border-border",
  Unpaid: "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)] border-[color:var(--status-warning)]/30",
  Paid: "bg-[color:var(--status-success)]/10 text-[color:var(--status-success)] border-[color:var(--status-success)]/30",
  Overdue: "bg-destructive/10 text-destructive border-destructive/30",
  Void: "bg-secondary/30 text-muted-foreground border-border",
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0)
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—"
  const t = new Date(d.length <= 10 ? `${d}T12:00:00` : d).getTime()
  if (Number.isNaN(t)) return "—"
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export type LinkedInvoicesSummaryProps = {
  invoices: AdminInvoice[]
  loading?: boolean
  className?: string
}

export function LinkedInvoicesSummary({
  invoices,
  loading = false,
  className,
}: LinkedInvoicesSummaryProps) {
  const list = React.useMemo(
    () => invoices.filter((i) => !i.isArchived).sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1)),
    [invoices],
  )
  const totalCents = list.reduce((s, i) => s + Math.round((i.amount || 0) * 100), 0)
  const paidCents = list
    .filter((i) => i.status === "Paid")
    .reduce((s, i) => s + Math.round((i.amount || 0) * 100), 0)
  const overdueCount = list.filter((i) => i.status === "Overdue").length
  const unpaidCount = list.filter((i) => i.status === "Unpaid" || i.status === "Sent").length
  const draftCount = list.filter((i) => i.status === "Draft").length

  if (loading) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
        <p className="text-xs text-muted-foreground">Loading linked invoices…</p>
      </div>
    )
  }

  if (list.length === 0) {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-4 space-y-2", className)}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Receipt className="w-3 h-3" /> Linked invoices
        </p>
        <p className="text-xs text-muted-foreground">No invoice has been created from this work order yet.</p>
      </div>
    )
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 space-y-3", className)}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Receipt className="w-3 h-3" /> Linked invoices
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {list.length} invoice{list.length === 1 ? "" : "s"} · Total {fmtCurrency(totalCents / 100)}
            {paidCents > 0 ? ` · Paid ${fmtCurrency(paidCents / 100)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {overdueCount > 0 ? (
            <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
              {overdueCount} overdue
            </Badge>
          ) : null}
          {unpaidCount > 0 ? (
            <Badge
              variant="outline"
              className="text-[10px] border-[color:var(--status-warning)]/30 text-[color:var(--status-warning)]"
            >
              {unpaidCount} awaiting payment
            </Badge>
          ) : null}
          {draftCount > 0 ? (
            <Badge variant="outline" className="text-[10px]">
              {draftCount} draft
            </Badge>
          ) : null}
          {paidCents === totalCents && totalCents > 0 ? (
            <Badge
              variant="outline"
              className="text-[10px] border-[color:var(--status-success)]/30 text-[color:var(--status-success)]"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" /> Paid in full
            </Badge>
          ) : null}
        </div>
      </div>

      <ul className="divide-y divide-border/60 -mx-1">
        {list.map((inv) => {
          const tone = STATUS_TONE[inv.status]
          const target = inv.invoiceNumber?.trim() || inv.id
          return (
            <li key={inv.id} className="flex items-center gap-3 px-1 py-2">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/invoices?open=${encodeURIComponent(target)}`}
                  className="text-xs font-mono font-medium text-primary hover:underline truncate block"
                >
                  {inv.invoiceNumber?.trim() || "Invoice"}
                </Link>
                <p className="text-[11px] text-muted-foreground truncate">
                  {fmtCurrency(inv.amount)} · Issued {fmtDate(inv.issueDate)}
                  {inv.dueDate ? ` · Due ${fmtDate(inv.dueDate)}` : ""}
                  {inv.termsCode ? ` · ${invoiceTermsCodeLabel(inv.termsCode)}` : ""}
                </p>
              </div>
              <Badge variant="outline" className={cn("text-[10px] font-semibold shrink-0", tone)}>
                {inv.status === "Sent" ? (
                  <>
                    <Clock className="w-3 h-3 mr-1" />
                    Sent
                  </>
                ) : (
                  inv.status
                )}
              </Badge>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
