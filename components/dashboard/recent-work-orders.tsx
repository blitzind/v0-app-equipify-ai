"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { WorkOrderDrawer } from "@/components/drawers/work-order-drawer"
import { cn } from "@/lib/utils"
import type { RecentWorkOrderRow } from "@/lib/dashboard/use-supabase-dashboard"
import { formatWorkOrderDisplay } from "@/lib/work-orders/display"
import { AlertTriangle } from "lucide-react"

const statusConfig: Record<string, { label: string; className: string }> = {
  "Open":        { label: "Open",        className: "bg-primary/10 text-primary border-primary/20" },
  "In Progress": { label: "In Progress", className: "bg-[oklch(0.65_0.15_162)]/10 text-[oklch(0.45_0.15_162)] border-[oklch(0.65_0.15_162)]/20" },
  "Completed":   { label: "Completed",   className: "bg-[oklch(0.62_0.17_145)]/10 text-[oklch(0.42_0.17_145)] border-[oklch(0.62_0.17_145)]/20" },
  "On Hold":     { label: "On Hold",     className: "bg-[oklch(0.75_0.16_70)]/10 text-[oklch(0.50_0.12_70)] border-[oklch(0.75_0.16_70)]/20" },
  "Scheduled":   { label: "Scheduled",   className: "bg-primary/10 text-primary border-primary/20" },
  "Invoiced":    { label: "Invoiced",    className: "bg-muted text-muted-foreground border-border" },
}

const priorityConfig: Record<string, { className: string }> = {
  "Critical": { className: "bg-destructive/10 text-destructive border-destructive/20" },
  "High":     { className: "bg-[oklch(0.75_0.16_70)]/10 text-[oklch(0.50_0.12_70)] border-[oklch(0.75_0.16_70)]/20" },
  "Normal":   { className: "bg-secondary text-secondary-foreground border-border" },
  "Low":      { className: "bg-secondary text-secondary-foreground border-border" },
}

export function RecentWorkOrders({
  rows,
  loading,
  error,
}: {
  rows: RecentWorkOrderRow[]
  loading?: boolean
  error?: string | null
}) {
  const [selectedWoId, setSelectedWoId] = useState<string | null>(null)

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Recent Work Orders</h2>
          <Link
            href="/work-orders"
            className="text-xs font-medium text-primary hover:underline underline-offset-2"
          >
            View all
          </Link>
        </div>
        {error && (
          <div className="px-5 py-2 text-xs text-destructive border-b border-border flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
            Could not refresh this list. Showing last loaded data if any.
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 whitespace-nowrap">WO #</th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 whitespace-nowrap">Customer</th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 whitespace-nowrap">Equipment</th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 whitespace-nowrap">Technician</th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 whitespace-nowrap">Priority</th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 whitespace-nowrap">Status</th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 whitespace-nowrap">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && rows.length === 0
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-5 py-3.5">
                        <div className="h-4 rounded bg-muted animate-pulse w-3/4 max-w-md" />
                      </td>
                    </tr>
                  ))
                : rows.length === 0
                  ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                          No work orders yet. Create one from Work Orders.
                        </td>
                      </tr>
                    )
                  : rows.map((wo) => {
                      const status   = statusConfig[wo.status]   ?? { label: wo.status,   className: "bg-secondary text-secondary-foreground border-border" }
                      const priority = priorityConfig[wo.priority] ?? { className: "bg-secondary text-secondary-foreground border-border" }
                      return (
                        <tr
                          key={wo.id}
                          onClick={() => setSelectedWoId(wo.id)}
                          className="group transition-colors duration-100 cursor-pointer"
                          style={{ backgroundColor: "var(--card)" }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "color-mix(in oklch, var(--primary) 3%, var(--card))")}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--card)")}
                          title="Open work order"
                        >
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold text-primary group-hover:underline underline-offset-2 ds-tabular">{formatWorkOrderDisplay(wo.workOrderNumber, wo.id)}</span>
                          </td>
                          <td className="px-3 py-3.5 text-sm text-foreground whitespace-nowrap font-medium">{wo.customer}</td>
                          <td className="px-3 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{wo.equipment}</td>
                          <td className="px-3 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{wo.technician}</td>
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <Badge variant="outline" className={cn("text-[10px] font-semibold", priority.className)}>
                              {wo.priority}
                            </Badge>
                          </td>
                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <Badge variant="outline" className={cn("text-[10px] font-semibold", status.className)}>
                              {status.label}
                            </Badge>
                          </td>
                          <td className="px-3 py-3.5 text-xs text-muted-foreground whitespace-nowrap ds-tabular">{wo.due}</td>
                        </tr>
                      )
                    })}
            </tbody>
          </table>
        </div>
      </div>

      <WorkOrderDrawer
        workOrderId={selectedWoId}
        onClose={() => setSelectedWoId(null)}
      />
    </>
  )
}
