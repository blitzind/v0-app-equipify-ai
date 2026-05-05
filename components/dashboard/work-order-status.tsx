"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import type { WorkOrderStatusSlice } from "@/lib/dashboard/use-supabase-dashboard"
import type { WorkOrderStatus } from "@/lib/mock-data"
import { AlertTriangle } from "lucide-react"

/** Pie fills aligned with Work Orders page `STATUS_STYLE` (badge hues → solid segments). */
const STATUS_CHART_FILL: Record<WorkOrderStatus, string> = {
  Open: "var(--status-info)",
  /** Same family as Open; distinct shade so slices differ like badge opacities on the list page. */
  Scheduled: "oklch(0.52 0.19 245)",
  "In Progress": "var(--status-warning)",
  Completed: "var(--status-success)",
  "Completed Pending Signature": "oklch(0.72 0.14 75)",
  Invoiced: "oklch(0.55 0.02 250)",
}

const STATUS_ORDER: WorkOrderStatus[] = [
  "Open",
  "Scheduled",
  "In Progress",
  "Completed",
  "Completed Pending Signature",
  "Invoiced",
]

function fillForStatus(status: string): string {
  if ((STATUS_ORDER as readonly string[]).includes(status)) {
    return STATUS_CHART_FILL[status as WorkOrderStatus]
  }
  return "oklch(0.6 0.12 240)"
}

function CenterLabel({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 22, fontWeight: 700, fill: "oklch(0.15 0.01 240)", fontVariantNumeric: "tabular-nums" }}>
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, fontWeight: 600, fill: "oklch(0.52 0.01 240)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        total
      </text>
    </g>
  )
}

export function WorkOrderStatus({
  slices,
  loading,
  error,
}: {
  slices: WorkOrderStatusSlice[]
  loading?: boolean
  error?: string | null
}) {
  const router = useRouter()
  const total = slices.reduce((s, d) => s + d.count, 0)

  const listRows = STATUS_ORDER.map((status) => {
    const found = slices.find((d) => d.status === status)
    return { status, count: found?.count ?? 0 }
  })

  function goToStatusFilter(status: string) {
    router.push(`/work-orders?status=${encodeURIComponent(status)}`)
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Work Orders by Status</h2>
        <Link
          href="/work-orders"
          className="text-xs font-medium text-muted-foreground ds-tabular hover:text-primary hover:underline underline-offset-2 transition-colors"
          title="View all work orders"
        >
          {total} total
        </Link>
      </div>
      {error && (
        <div className="px-5 py-2 text-xs text-destructive border-b border-border flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
          Could not refresh chart.
        </div>
      )}
      <div className="px-4 py-3 flex-1 min-h-0">
        {loading && total === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 md:items-center">
            <div className="space-y-2 min-h-[160px]">
              {STATUS_ORDER.map((s) => (
                <div key={s} className="h-5 rounded bg-muted/50 animate-pulse" />
              ))}
            </div>
            <div className="h-[200px] max-w-[260px] mx-auto w-full rounded-lg bg-muted/50 animate-pulse md:max-w-none" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 md:items-center">
            <ul className="flex flex-col gap-2 text-left min-w-0" aria-label="Work orders by status">
              {listRows.map(({ status, count }) => (
                <li key={status}>
                  <button
                    type="button"
                    onClick={() => goToStatusFilter(status)}
                    className="flex w-full items-center gap-2.5 rounded-md py-1 pr-1 text-left text-xs hover:bg-muted/60 transition-colors cursor-pointer"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full border border-border/50"
                      style={{ backgroundColor: fillForStatus(status) }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 font-medium text-foreground leading-tight">{status}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-foreground">{count}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="relative h-[200px] w-full min-w-0 flex items-center justify-center mx-auto md:mx-0 max-w-[260px] md:max-w-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    strokeWidth={2}
                    stroke="var(--card)"
                    onClick={(entry: { status?: string }) => {
                      if (entry?.status) goToStatusFilter(entry.status)
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {slices.map((slice, index) => (
                      <Cell key={`${slice.status}-${index}`} fill={fillForStatus(slice.status)} />
                    ))}
                    {/* @ts-expect-error — Recharts passes cx/cy via render prop into children */}
                    <CenterLabel total={total} />
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [v, name]}
                    contentStyle={{
                      backgroundColor: "oklch(1 0 0)",
                      border: "1px solid oklch(0.88 0.008 240)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
