"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { EquipmentDrawer } from "@/components/drawers/equipment-drawer"
import type { RepeatRepairRow } from "@/lib/dashboard/use-supabase-dashboard"

export function RepeatRepairs({
  items,
  loading,
  error,
}: {
  items: RepeatRepairRow[]
  loading?: boolean
  error?: string | null
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <>
      <div className="bg-card rounded-xl border border-destructive/25 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h2 className="text-sm font-semibold text-foreground">Repeat Repair Alerts</h2>
          </div>
          <Link href="/work-orders">
            <Badge
              variant="outline"
              className="text-[10px] font-semibold bg-destructive/8 text-destructive border-destructive/25 cursor-pointer hover:bg-destructive/15 transition-colors"
              title="View work orders"
            >
              {items.length} flagged
            </Badge>
          </Link>
        </div>
        {error && (
          <div className="px-5 py-2 text-xs text-destructive border-b border-border flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
            Could not refresh. Showing last loaded data if any.
          </div>
        )}
        {loading && items.length === 0 ? (
          <ul className="divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="px-5 py-4">
                <div className="h-4 rounded bg-muted animate-pulse w-4/5" />
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-4">
            <AlertTriangle className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No repeat repair patterns</p>
            <p className="text-xs text-muted-foreground/80 max-w-[280px] leading-relaxed">
              We flag equipment with two or more work orders in the last 90 days. None match that rule right now.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li
                key={item.equipmentId}
                onClick={() => setSelectedId(item.equipmentId)}
                className="px-5 py-4 transition-colors duration-100 cursor-pointer group"
                style={{ backgroundColor: "var(--card)" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "color-mix(in oklch, var(--destructive) 3%, var(--card))")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--card)")}
                title={`Open ${item.equipmentName}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-destructive transition-colors">{item.equipmentName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.customerName}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1.5 italic leading-relaxed">&ldquo;{item.issue}&rdquo;</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold ds-tabular ring-1 ring-destructive/20">
                      {item.repairs}&times;
                    </span>
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5 ds-tabular">Last: {item.lastRepair}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EquipmentDrawer
        equipmentId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  )
}
