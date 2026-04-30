"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { workOrdersByStatus } from "@/lib/mock-data"

const COLORS = [
  "oklch(0.52 0.18 231)",
  "oklch(0.65 0.15 162)",
  "oklch(0.62 0.17 145)",
  "oklch(0.75 0.16 70)",
]

export function WorkOrderStatus() {
  const total = workOrdersByStatus.reduce((s, d) => s + d.count, 0)

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Open Work Orders</h2>
        <p className="text-xs text-muted-foreground">{total} total</p>
      </div>
      <div className="px-4 py-2">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={workOrdersByStatus}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={3}
              strokeWidth={0}
            >
              {workOrdersByStatus.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, name: string) => [v, name]}
              contentStyle={{
                backgroundColor: "oklch(1 0 0)",
                border: "1px solid oklch(0.88 0.008 240)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span style={{ fontSize: 11, color: "oklch(0.52 0.01 240)" }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
