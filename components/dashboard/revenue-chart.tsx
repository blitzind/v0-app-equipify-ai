"use client"

import Link from "next/link"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { RevenueMonthPoint } from "@/lib/dashboard/use-supabase-dashboard"
import { AlertTriangle } from "lucide-react"

function formatAxisK(v: number) {
  if (v >= 1000) return "$" + (v / 1000).toFixed(0) + "k"
  return "$" + Math.round(v).toLocaleString()
}

export function RevenueChart({
  data,
  loading,
  error,
}: {
  data: RevenueMonthPoint[]
  loading?: boolean
  error?: string | null
}) {
  const last = data.length >= 2 ? data[data.length - 1]!.revenue : data[0]?.revenue ?? 0
  const prev = data.length >= 2 ? data[data.length - 2]!.revenue : 0
  const pct =
    prev > 0 ? (((last - prev) / prev) * 100).toFixed(1) : null
  const headline = `$${last.toLocaleString()}`
  const subline =
    prev > 0 && pct !== null
      ? `${Number(pct) >= 0 ? "+" : ""}${pct}% vs prior month`
      : last === 0
        ? "No completed / invoiced revenue in window"
        : "First month in range"

  const maxRev = Math.max(0, ...data.map((d) => d.revenue))
  const yMax = maxRev <= 0 ? 1000 : Math.ceil(maxRev * 1.15)

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] h-full flex flex-col">
      <Link
        href="/reports"
        className="flex items-center justify-between px-5 py-4 border-b border-border group hover:bg-muted/30 transition-colors cursor-pointer"
        title="View revenue report"
      >
        <div>
          <h2 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Monthly Revenue</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Last 6 months (completed & invoiced)</p>
        </div>
        <div className="text-right min-w-0">
          {loading && data.every((d) => d.revenue === 0) ? (
            <div className="h-7 w-24 rounded bg-muted animate-pulse ml-auto" />
          ) : (
            <>
              <p className="text-xl font-bold text-foreground ds-tabular">{headline}</p>
              <p
                className={`text-xs font-semibold ${
                  pct !== null && Number(pct) < 0 ? "text-destructive" : "text-[oklch(0.42_0.17_145)]"
                }`}
              >
                {subline}
              </p>
            </>
          )}
        </div>
      </Link>
      {error && (
        <div className="px-5 py-2 text-xs text-destructive border-b border-border flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
          Chart may be stale.
        </div>
      )}
      <div className="px-4 py-4">
        {loading && data.every((d) => d.revenue === 0) ? (
          <div className="h-[160px] rounded-lg bg-muted/50 animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.52 0.18 231)" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="oklch(0.52 0.18 231)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.008 240)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "oklch(0.52 0.01 240)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatAxisK}
                tick={{ fontSize: 11, fill: "oklch(0.52 0.01 240)" }}
                axisLine={false}
                tickLine={false}
                domain={[0, yMax]}
              />
              <Tooltip
                formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]}
                contentStyle={{
                  backgroundColor: "oklch(1 0 0)",
                  border: "1px solid oklch(0.88 0.008 240)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="oklch(0.52 0.18 231)"
                strokeWidth={2.5}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{ r: 5, fill: "oklch(0.52 0.18 231)", strokeWidth: 2, stroke: "white" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
