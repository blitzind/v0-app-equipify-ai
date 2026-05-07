"use client"

/**
 * Customer Hierarchy — Phase 2
 *
 * Operational rollup card mounted on the **parent** customer detail page.
 * Aggregates equipment, locations, work orders, and invoice totals across
 * the parent + its descendant accounts.
 *
 * Strict rules:
 *   - never expose raw UUIDs (parent/child names come from the rollup tree)
 *   - dark-mode + mobile responsive
 *   - non-blocking: renders a soft loading state and degrades to zero values
 *     on RLS deny / network error
 */

import Link from "next/link"
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  Layers,
  MapPin,
  ReceiptText,
  Wrench,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  formatCentsCompact,
  type CustomerRollupMetrics,
} from "@/lib/customers/rollup-metrics"

type Props = {
  metrics: CustomerRollupMetrics | null
  loading?: boolean
  /** Root customer name; used in helper copy. */
  rootCompanyName: string
  className?: string
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
      {sub ? (
        <span className="text-[10px] text-muted-foreground">{sub}</span>
      ) : null}
    </div>
  )
}

export function CustomerRollupCard({ metrics, loading, rootCompanyName, className }: Props) {
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

  const {
    childAccountCount,
    locationCount,
    equipmentCount,
    openWorkOrderCount,
    overdueWorkOrderCount,
    inProgressWorkOrderCount,
    invoiceTotalsCents,
  } = metrics

  if (childAccountCount === 0) return null

  return (
    <Card className={cn("border-border", className)}>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
          Parent rollup
        </CardTitle>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          {childAccountCount} sub-account{childAccountCount === 1 ? "" : "s"}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Operational totals across <span className="font-medium text-foreground">{rootCompanyName}</span>{" "}
          and its sub-accounts. Click any sub-account below to drill in.
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <StatCell
            icon={<Layers className="h-3 w-3" aria-hidden />}
            label="Sub-accounts"
            value={String(childAccountCount)}
            tone="primary"
          />
          <StatCell
            icon={<MapPin className="h-3 w-3" aria-hidden />}
            label="Locations"
            value={String(locationCount)}
          />
          <StatCell
            icon={<Wrench className="h-3 w-3" aria-hidden />}
            label="Equipment"
            value={String(equipmentCount)}
          />
          <StatCell
            icon={<ClipboardList className="h-3 w-3" aria-hidden />}
            label="Open WOs"
            value={String(openWorkOrderCount)}
            sub={inProgressWorkOrderCount > 0 ? `${inProgressWorkOrderCount} in progress` : undefined}
            tone={openWorkOrderCount > 0 ? "warning" : "default"}
          />
          <StatCell
            icon={<AlertTriangle className="h-3 w-3" aria-hidden />}
            label="Overdue WOs"
            value={String(overdueWorkOrderCount)}
            tone={overdueWorkOrderCount > 0 ? "danger" : "default"}
          />
          <StatCell
            icon={<ReceiptText className="h-3 w-3" aria-hidden />}
            label="Unpaid total"
            value={formatCentsCompact(invoiceTotalsCents.unpaid)}
            tone={invoiceTotalsCents.unpaid > 0 ? "warning" : "default"}
          />
          <StatCell
            icon={<AlertTriangle className="h-3 w-3" aria-hidden />}
            label="Overdue total"
            value={formatCentsCompact(invoiceTotalsCents.overdue)}
            tone={invoiceTotalsCents.overdue > 0 ? "danger" : "default"}
          />
          <StatCell
            icon={<ReceiptText className="h-3 w-3" aria-hidden />}
            label="Paid (1y)"
            value={formatCentsCompact(invoiceTotalsCents.paidLast365)}
            sub="last 365 days"
          />
        </div>

        {metrics.tree.length > 1 ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sub-accounts in this rollup:
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
            {metrics.tree.length - 1 > 8 ? (
              <span className="text-[11px] text-muted-foreground">
                + {metrics.tree.length - 1 - 8} more
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
