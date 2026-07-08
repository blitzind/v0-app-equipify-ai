"use client"

import type { RevenueQueueCardView } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { computeDashboardKpis } from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"
import { cn } from "@/lib/utils"

function KpiCell({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3 shadow-sm",
        highlight && "border-emerald-200 bg-emerald-50/50",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

export function RevenueKpiStrip({ cards }: { cards: RevenueQueueCardView[] }) {
  const kpi = computeDashboardKpis(cards)

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <KpiCell label="New leads" value={kpi.newLeads} />
      <KpiCell label="Purchase ready" value={kpi.purchaseReady} highlight />
      <KpiCell label="High intent visitors" value={kpi.highIntentVisitors} />
      <KpiCell label="Needs review" value={kpi.needsReview} />
      <KpiCell label="Returning accounts" value={kpi.returningAccounts} />
      <KpiCell label="High priority queue" value={kpi.highPriorityQueue} highlight />
    </div>
  )
}
