"use client"

import { useState } from "react"
import Link from "next/link"
import { Shield, AlertTriangle } from "lucide-react"
import { EquipmentDrawer } from "@/components/drawers/equipment-drawer"
import { cn } from "@/lib/utils"
import type { WarrantyRow } from "@/lib/dashboard/use-supabase-dashboard"

export function ExpiringWarranties({
  items,
  loading,
  error,
}: {
  items: WarrantyRow[]
  loading?: boolean
  error?: string | null
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[oklch(0.72_0.17_70)]" />
            <h2 className="text-sm font-semibold text-foreground">Expiring Warranties</h2>
          </div>
          <Link
            href="/equipment"
            className="text-xs font-medium text-primary hover:underline underline-offset-2 transition-colors"
          >
            Manage
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
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="px-5 py-3.5">
                <div className="h-4 rounded bg-muted animate-pulse w-4/5" />
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-4">
            <Shield className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No warranties expiring in the next 30 days</p>
            <p className="text-xs text-muted-foreground/80 max-w-[280px] leading-relaxed">
              Add <span className="font-medium text-muted-foreground">warranty end dates</span> on equipment records to track coverage and see expirations here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const urgent = item.daysLeft <= 15
              return (
                <li
                  key={item.equipmentId}
                  onClick={() => setSelectedId(item.equipmentId)}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors duration-100 cursor-pointer group"
                  style={{ backgroundColor: "var(--card)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "color-mix(in oklch, var(--primary) 3%, var(--card))")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--card)")}
                  title={`Open ${item.equipmentName}`}
                >
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full text-xs font-bold shrink-0 ds-tabular",
                    "transition-transform duration-150 group-hover:scale-105",
                    urgent
                      ? "bg-destructive/10 text-destructive ring-1 ring-destructive/20"
                      : "bg-[oklch(0.75_0.16_70)]/10 text-[oklch(0.50_0.12_70)]",
                  )}>
                    {item.daysLeft}d
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{item.equipmentName}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{item.customerName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">Expires</p>
                    <p className={cn("text-xs font-semibold ds-tabular mt-0.5", urgent ? "text-destructive" : "text-foreground")}>{item.expires}</p>
                  </div>
                </li>
              )
            })}
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
