"use client"

/**
 * Invoicing Phase 3 — Customer invoice aging card.
 *
 * Compact aging summary for the customer detail page. Renders single-customer
 * metrics by default; when `consolidated` is true and the row has children,
 * shows a "Consolidated with sub-accounts" pill that makes the rollup
 * unambiguous to office staff.
 */

import * as React from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FilePen,
  GitBranch,
  Receipt,
} from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  fmtCentsCurrency,
  type InvoiceAgingSummary,
} from "@/lib/billing/invoice-aging"

export type CustomerInvoiceAgingCardProps = {
  summary: InvoiceAgingSummary
  loading?: boolean
  /** When true, renders the "consolidated with sub-accounts" badge. */
  consolidated?: boolean
  /** Number of sub-accounts (used in the consolidated subtitle). */
  childCount?: number
  /** Optional href to navigate to the org-wide invoice list scoped to this customer. */
  invoicesHref?: string
  className?: string
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—"
  const t = new Date(d.length <= 10 ? `${d}T12:00:00` : d).getTime()
  if (Number.isNaN(t)) return "—"
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function CustomerInvoiceAgingCard({
  summary,
  loading = false,
  consolidated = false,
  childCount = 0,
  invoicesHref,
  className,
}: CustomerInvoiceAgingCardProps) {
  const buckets = summary.buckets
  const hasOpen = summary.unpaidCount > 0 || summary.draftPendingCount > 0
  const totalsRow: { label: string; value: string; tone: string; icon: React.ElementType }[] = [
    {
      label: "Open balance",
      value: fmtCentsCurrency(summary.openBalanceCents),
      tone: summary.overdueBalanceCents > 0 ? "text-destructive" : "text-foreground",
      icon: Receipt,
    },
    {
      label: "Overdue",
      value: fmtCentsCurrency(summary.overdueBalanceCents),
      tone:
        summary.overdueBalanceCents > 0
          ? "text-destructive"
          : "text-muted-foreground",
      icon: AlertTriangle,
    },
    {
      label: "Drafts pending",
      value: fmtCentsCurrency(summary.draftPendingBalanceCents),
      tone: "text-foreground",
      icon: FilePen,
    },
    {
      label: "Paid last 12 mo",
      value: fmtCentsCurrency(summary.paidLast12moBalanceCents),
      tone: "text-[color:var(--status-success)]",
      icon: CheckCircle2,
    },
  ]

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 space-y-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Receipt className="w-3 h-3" /> Invoice aging
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {consolidated
              ? `Consolidated across this account and ${childCount} sub-account${childCount === 1 ? "" : "s"}.`
              : "Outstanding invoice activity for this customer."}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {consolidated ? (
            <Badge variant="outline" className="text-[10px] gap-1">
              <GitBranch className="w-3 h-3" /> Rollup
            </Badge>
          ) : null}
          {summary.overdueCount > 0 ? (
            <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
              {summary.overdueCount} overdue
            </Badge>
          ) : null}
          {summary.unpaidCount > 0 && summary.overdueCount === 0 ? (
            <Badge
              variant="outline"
              className="text-[10px] border-[color:var(--status-warning)]/30 text-[color:var(--status-warning)]"
            >
              {summary.unpaidCount} awaiting payment
            </Badge>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading invoice aging…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {totalsRow.map((row) => {
              const Icon = row.icon
              return (
                <div
                  key={row.label}
                  className="rounded-lg border border-border bg-background/60 p-3 space-y-1"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <Icon className="w-3 h-3" aria-hidden /> {row.label}
                  </p>
                  <p className={cn("text-base font-semibold tabular-nums", row.tone)}>
                    {row.value}
                  </p>
                </div>
              )
            })}
          </div>

          {hasOpen ? (
            <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3 h-3" aria-hidden /> Open invoice aging buckets
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <BucketCell label="Current" cents={buckets.current} />
                <BucketCell label="0–30 days" cents={buckets.bucket0_30} tone="warning" />
                <BucketCell label="31–60 days" cents={buckets.bucket31_60} tone="warning" />
                <BucketCell label="61–90 days" cents={buckets.bucket61_90} tone="danger" />
                <BucketCell label="90+ days" cents={buckets.bucket90Plus} tone="danger" />
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>
              {summary.oldestOpenIssueDate
                ? `Oldest unpaid issued ${fmtDate(summary.oldestOpenIssueDate)}.`
                : summary.newestPaidDate
                  ? `Last payment received ${fmtDate(summary.newestPaidDate)}.`
                  : "No invoice history yet."}
            </span>
            {invoicesHref ? (
              <Link
                href={invoicesHref}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Open in invoices <ChevronRight className="w-3 h-3" />
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

function BucketCell({
  label,
  cents,
  tone,
}: {
  label: string
  cents: number
  tone?: "warning" | "danger"
}) {
  const colorClass =
    cents > 0 && tone === "danger"
      ? "text-destructive"
      : cents > 0 && tone === "warning"
        ? "text-[color:var(--status-warning)]"
        : "text-foreground"
  return (
    <div className="rounded-md border border-border/60 bg-card px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-xs font-semibold tabular-nums mt-0.5", colorClass)}>
        {fmtCentsCurrency(cents)}
      </p>
    </div>
  )
}
