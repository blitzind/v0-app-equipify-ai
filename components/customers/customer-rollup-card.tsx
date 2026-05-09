"use client"

/**
 * Parent-account rollup on customer detail — operational + optional financial totals.
 * Phase 33: **direct** (this customer) vs **with sub-accounts** (rolled up).
 */

import Link from "next/link"
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  FilePen,
  Inbox,
  MapPin,
  ReceiptText,
  Wrench,
  CalendarClock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  formatCentsCompact,
  type CustomerRollupMetrics,
  type CustomerRollupSlice,
} from "@/lib/customers/rollup-metrics"

type Props = {
  metrics: CustomerRollupMetrics | null
  loading?: boolean
  rootCompanyName: string
  className?: string
  /** Mirrors `loadCustomerRollupMetrics({ includeFinancialRollup })`. */
  financialRollupEnabled: boolean
  /** Mirrors `loadCustomerRollupMetrics({ includeQuotesRollup })`. */
  quotesRollupEnabled: boolean
}

function StatCell({
  icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone?: "default" | "warning" | "danger" | "primary"
}) {
  const toneCls =
    tone === "warning"
      ? "border-[color:var(--status-warning)]/35 bg-[color:var(--status-warning)]/5"
      : tone === "danger"
        ? "border-destructive/35 bg-destructive/5"
        : tone === "primary"
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-muted/25"

  const valueCls =
    tone === "warning"
      ? "text-[color:var(--status-warning)]"
      : tone === "danger"
        ? "text-destructive"
        : "text-foreground"

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 shadow-[inset_0_1px_0_rgba(0,0,0,0.02)]",
        toneCls,
      )}
    >
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={cn("text-base font-semibold tabular-nums leading-tight", valueCls)}>
        {value}
      </span>
      {sub ? <span className="text-[10px] text-muted-foreground">{sub}</span> : null}
    </div>
  )
}

function SliceSection({
  title,
  slice,
  showFinancials,
  showQuotes,
}: {
  title: string
  slice: CustomerRollupSlice
  showFinancials: boolean
  showQuotes: boolean
}) {
  const fin = slice.invoiceTotalsCents
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <StatCell
          icon={<MapPin className="h-3 w-3" aria-hidden />}
          label="Locations"
          value={String(slice.locationCount)}
        />
        <StatCell
          icon={<Wrench className="h-3 w-3" aria-hidden />}
          label="Equipment"
          value={String(slice.equipmentCount)}
        />
        <StatCell
          icon={<ClipboardList className="h-3 w-3" aria-hidden />}
          label="Open WOs"
          value={String(slice.openWorkOrderCount)}
          sub={slice.inProgressWorkOrderCount > 0 ? `${slice.inProgressWorkOrderCount} in progress` : undefined}
          tone={slice.openWorkOrderCount > 0 ? "warning" : "default"}
        />
        <StatCell
          icon={<AlertTriangle className="h-3 w-3" aria-hidden />}
          label="Overdue WOs"
          value={String(slice.overdueWorkOrderCount)}
          tone={slice.overdueWorkOrderCount > 0 ? "danger" : "default"}
        />
        <StatCell
          icon={<Inbox className="h-3 w-3" aria-hidden />}
          label="Open requests"
          value={String(slice.openServiceRequestCount)}
          tone={slice.openServiceRequestCount > 0 ? "warning" : "default"}
        />
        <StatCell
          icon={<CalendarClock className="h-3 w-3" aria-hidden />}
          label="Upcoming maint."
          value={String(slice.upcomingMaintenanceCount)}
          sub="next 60 days"
        />
        {showQuotes ?
          <StatCell
            icon={<FilePen className="h-3 w-3" aria-hidden />}
            label="Open quotes"
            value={String(slice.openQuotesCount)}
            sub="draft / sent / pending"
            tone={slice.openQuotesCount > 0 ? "primary" : "default"}
          />
        : null}
        {showFinancials && fin ?
          <>
            <StatCell
              icon={<ReceiptText className="h-3 w-3" aria-hidden />}
              label="Unpaid total"
              value={formatCentsCompact(fin.unpaid)}
              tone={fin.unpaid > 0 ? "warning" : "default"}
            />
            <StatCell
              icon={<AlertTriangle className="h-3 w-3" aria-hidden />}
              label="Overdue total"
              value={formatCentsCompact(fin.overdue)}
              tone={fin.overdue > 0 ? "danger" : "default"}
            />
            <StatCell
              icon={<ReceiptText className="h-3 w-3" aria-hidden />}
              label="Paid (1y)"
              value={formatCentsCompact(fin.paidLast365)}
              sub="last 365 days"
            />
          </>
        : null}
      </div>
    </div>
  )
}

export function CustomerRollupCard({
  metrics,
  loading,
  rootCompanyName,
  className,
  financialRollupEnabled,
  quotesRollupEnabled,
}: Props) {
  if (loading || !metrics) {
    return (
      <Card className={cn("border-border", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
            Parent rollup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading rollup metrics…" : "Rollup unavailable."}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (metrics.childAccountCount === 0) return null

  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
          Parent rollup
        </CardTitle>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          {metrics.childAccountCount} sub-account{metrics.childAccountCount === 1 ? "" : "s"}
        </span>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          Reporting-only totals for <span className="font-medium text-foreground">{rootCompanyName}</span>. Invoices
          stay owned by each sub-account; nothing is merged for billing.
        </p>

        <SliceSection
          title="This account (direct)"
          slice={metrics.direct}
          showFinancials={financialRollupEnabled}
          showQuotes={quotesRollupEnabled}
        />

        <div className="border-t border-border pt-4">
          <SliceSection
            title="With all sub-accounts (rolled up)"
            slice={metrics.withSubAccounts}
            showFinancials={financialRollupEnabled}
            showQuotes={quotesRollupEnabled}
          />
        </div>

        {!financialRollupEnabled ?
          <p className="text-[11px] text-muted-foreground">
            Invoice and payment totals are hidden without billing or financial visibility.
          </p>
        : null}

        {metrics.tree.length > 1 ?
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sub-accounts:
            </span>
            {metrics.tree
              .filter((t) => t.id !== metrics.tree[0]?.id)
              .slice(0, 8)
              .map((node) => (
                <Link
                  key={node.id}
                  href={`/customers/${node.id}`}
                  className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted"
                >
                  {node.companyName}
                </Link>
              ))}
            {metrics.tree.length - 1 > 8 ?
              <span className="text-[11px] text-muted-foreground">+ {metrics.tree.length - 1 - 8} more</span>
            : null}
          </div>
        : null}
      </CardContent>
    </Card>
  )
}
