"use client"

/**
 * Equipment Intelligence — Phase 2
 *
 * Reusable category breakdown card. Shown on:
 *   - Customer detail (scoped to a customer + descendants when parent)
 *   - Reports page (org-wide)
 *
 * Renders a compact table: category | equipment | open WOs | upcoming due |
 * completed WOs | revenue.
 */

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  formatCentsCompact,
  type EquipmentCategoryBreakdownRow,
} from "@/lib/equipment/intelligence-rollup"

export type EquipmentCategoryBreakdownCardProps = {
  rows: EquipmentCategoryBreakdownRow[] | null
  loading?: boolean
  /**
   * "Equipment intelligence" by default. Customer detail can pass a
   * customer-aware variant.
   */
  title?: string
  /** Optional subtitle right under the title. */
  subtitle?: string
  /** Empty state copy. */
  emptyLabel?: string
  /** Hide the revenue column on density-only views. Default false. */
  hideRevenue?: boolean
  /** Soft cap of rows surfaced in the table; remainder is summarized. */
  maxRows?: number
  className?: string
}

export function EquipmentCategoryBreakdownCard({
  rows,
  loading,
  title = "Equipment intelligence",
  subtitle = "Open service load and revenue grouped by equipment type.",
  emptyLabel = "No equipment activity yet for this scope.",
  hideRevenue = false,
  maxRows = 8,
  className,
}: EquipmentCategoryBreakdownCardProps) {
  const data = rows ?? []
  const visible = data.slice(0, maxRows)
  const overflow = data.slice(maxRows)
  const overflowCount = overflow.length
  const overflowSummary = React.useMemo(() => {
    if (overflowCount === 0) return null
    return overflow.reduce(
      (acc, r) => {
        acc.equipmentCount += r.equipmentCount
        acc.openWorkOrderCount += r.openWorkOrderCount
        acc.completedWorkOrderCount += r.completedWorkOrderCount
        acc.upcomingDueCount += r.upcomingDueCount
        acc.overdueCount += r.overdueCount
        acc.revenueCents += r.revenueCents
        return acc
      },
      {
        equipmentCount: 0,
        openWorkOrderCount: 0,
        completedWorkOrderCount: 0,
        upcomingDueCount: 0,
        overdueCount: 0,
        revenueCents: 0,
      },
    )
  }, [overflow, overflowCount])

  return (
    <Card className={cn("border-border bg-card shadow-sm", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
        {subtitle ? (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">{emptyLabel}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border ds-table-header-row-subtle">
                  <th className="text-left text-muted-foreground font-medium pb-2 pr-3">
                    Category
                  </th>
                  <th className="text-right text-muted-foreground font-medium pb-2 pr-3">
                    Equipment
                  </th>
                  <th className="text-right text-muted-foreground font-medium pb-2 pr-3">
                    Open WOs
                  </th>
                  <th className="text-right text-muted-foreground font-medium pb-2 pr-3">
                    Upcoming due
                  </th>
                  <th className="text-right text-muted-foreground font-medium pb-2 pr-3">
                    Completed WOs
                  </th>
                  {!hideRevenue ? (
                    <th className="text-right text-muted-foreground font-medium pb-2">
                      Revenue
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.category} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-foreground truncate">
                      {r.category}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-foreground">
                      {r.equipmentCount}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <span
                        className={cn(
                          r.openWorkOrderCount > 0
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {r.openWorkOrderCount}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      {r.overdueCount > 0 ? (
                        <span className="text-destructive font-semibold">
                          {r.upcomingDueCount + r.overdueCount}
                          <span className="ml-1 text-[10px] font-normal text-destructive/80">
                            ({r.overdueCount} overdue)
                          </span>
                        </span>
                      ) : r.upcomingDueCount > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          {r.upcomingDueCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-muted-foreground">
                      {r.completedWorkOrderCount}
                    </td>
                    {!hideRevenue ? (
                      <td className="py-2.5 text-right font-bold text-foreground">
                        {formatCentsCompact(r.revenueCents)}
                      </td>
                    ) : null}
                  </tr>
                ))}
                {overflowSummary ? (
                  <tr className="border-b border-border/50 last:border-0 bg-muted/30">
                    <td className="py-2.5 pr-3 italic text-muted-foreground">
                      +{overflowCount} more categor{overflowCount === 1 ? "y" : "ies"}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-muted-foreground">
                      {overflowSummary.equipmentCount}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-muted-foreground">
                      {overflowSummary.openWorkOrderCount}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-muted-foreground">
                      {overflowSummary.upcomingDueCount + overflowSummary.overdueCount}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-muted-foreground">
                      {overflowSummary.completedWorkOrderCount}
                    </td>
                    {!hideRevenue ? (
                      <td className="py-2.5 text-right text-muted-foreground">
                        {formatCentsCompact(overflowSummary.revenueCents)}
                      </td>
                    ) : null}
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
