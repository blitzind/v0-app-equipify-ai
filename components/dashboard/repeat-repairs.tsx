"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { useWorkspaceData } from "@/lib/tenant-store"
import { Badge } from "@/components/ui/badge"
import { EquipmentDrawer } from "@/components/drawers/equipment-drawer"

export function RepeatRepairs() {
  const { repeatRepairs, equipment } = useWorkspaceData()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Build name → id map dynamically from workspace equipment
  const equipmentNameToId = Object.fromEntries(
    equipment.map((e) => [e.model, e.id])
  )

  return (
    <>
      <div className="bg-card rounded-xl border border-destructive/25 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h2 className="text-sm font-semibold text-foreground">Repeat Repair Alerts</h2>
          </div>
          <Link href="/insights">
            <Badge
              variant="outline"
              className="text-[10px] font-semibold bg-destructive/8 text-destructive border-destructive/25 cursor-pointer hover:bg-destructive/15 transition-colors"
              title="View in AI Insights"
            >
              {repeatRepairs.length} flagged
            </Badge>
          </Link>
        </div>
        {repeatRepairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <AlertTriangle className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No repeat repairs flagged</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {repeatRepairs.map((item, i) => {
              const eqId = equipmentNameToId[item.equipment] ?? null
              return (
                <li
                  key={i}
                  onClick={() => eqId && setSelectedId(eqId)}
                  className="px-5 py-4 transition-colors duration-100 cursor-pointer group"
                  style={{ backgroundColor: "var(--card)" }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "color-mix(in oklch, var(--destructive) 3%, var(--card))")}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "var(--card)")}
                  title={eqId ? `Open ${item.equipment}` : undefined}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-destructive transition-colors">{item.equipment}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.customer}</p>
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
