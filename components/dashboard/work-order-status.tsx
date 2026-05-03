"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import type { WorkOrderStatusSlice } from "@/lib/dashboard/use-supabase-dashboard"
import { AlertTriangle } from "lucide-react"

const COLORS = [
  "oklch(0.52 0.18 231)",
  "oklch(0.65 0.15 162)",
  "oklch(0.62 0.17 145)",
  "oklch(0.75 0.16 70)",
]

function CenterLabel({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 22, fontWeight: 700, fill: "oklch(0.15 0.01 240)", fontVariantNumeric: "tabular-nums" }}>
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, fontWeight: 600, fill: "oklch(0.52 0.01 240)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        open
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

  function handleSliceClick(data: { status: string }) {
    router.push(`/work-orders?status=${encodeURIComponent(data.status)}`)
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Open Work Orders</h2>
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
      <div className="px-4 py-2">
        {loading && total === 0 ? (
          <div className="h-[188px] rounded-lg bg-muted/50 animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={188}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="46%"
                innerRadius={50}
                outerRadius={74}
                paddingAngle={2}
                strokeWidth={2}
                stroke="var(--card)"
                onClick={handleSliceClick}
                style={{ cursor: "pointer" }}
              >
                {slices.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
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
              <Legend
                iconType="circle"
                iconSize={7}
                wrapperStyle={{ paddingTop: 4, fontSize: 11 }}
                formatter={(value) => (
                  <span style={{ fontSize: 11, color: "oklch(0.45 0.01 240)", fontWeight: 500 }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
