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
import { revenueData } from "@/lib/mock-data"

function formatCurrency(v: number) {
  return "$" + (v / 1000).toFixed(0) + "k"
}

export function RevenueChart() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      <Link
        href="/reports"
        className="flex items-center justify-between px-5 py-4 border-b border-border group hover:bg-muted/30 transition-colors cursor-pointer"
        title="View revenue report"
      >
        <div>
          <h2 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Monthly Revenue</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Last 6 months</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-foreground ds-tabular">$184,250</p>
          <p className="text-xs text-[oklch(0.42_0.17_145)] font-semibold">+7.1% vs last month</p>
        </div>
      </Link>
      <div className="px-4 py-4">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11, fill: "oklch(0.52 0.01 240)" }}
              axisLine={false}
              tickLine={false}
              domain={["dataMin - 20000", "dataMax + 10000"]}
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
      </div>
    </div>
  )
}
