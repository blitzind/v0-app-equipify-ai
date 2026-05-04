"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import type { DispatchTech, DispatchWo } from "./dispatch-board"
import { formatSlotLabel, timeToSlotIndex } from "@/lib/dispatch/board-utils"

function cardTone(status: string): string {
  switch (status) {
    case "open":
      return "border-[color:var(--status-info)]/40 bg-[color:var(--status-info)]/12"
    case "scheduled":
      return "border-[color:var(--status-info)]/35 bg-[color:var(--status-info)]/15"
    case "in_progress":
      return "border-[color:var(--status-warning)]/40 bg-[color:var(--status-warning)]/12"
    case "completed":
      return "border-[color:var(--status-success)]/40 bg-[color:var(--status-success)]/12"
    case "invoiced":
      return "border-border bg-muted/50"
    default:
      return "border-border bg-card"
  }
}

export function DispatchMobileList({
  technicians,
  workOrders,
  selectedYmd,
  onOpenWo,
}: {
  technicians: DispatchTech[]
  workOrders: DispatchWo[]
  selectedYmd: string
  onOpenWo: (id: string) => void
}) {
  const unassigned = useMemo(
    () => workOrders.filter((w) => !w.assigned_user_id && ["open", "scheduled", "in_progress"].includes(w.status)),
    [workOrders],
  )

  const byTech = useMemo(() => {
    const map = new Map<string, DispatchWo[]>()
    for (const t of technicians) map.set(t.id, [])
    for (const wo of workOrders) {
      if (!wo.assigned_user_id || wo.scheduled_on !== selectedYmd) continue
      const list = map.get(wo.assigned_user_id)
      if (!list) continue
      list.push(wo)
    }
    for (const [, list] of map) {
      list.sort((a, b) => timeToSlotIndex(a.scheduled_time) - timeToSlotIndex(b.scheduled_time))
    }
    return map
  }, [workOrders, selectedYmd, technicians])

  return (
    <div className="flex flex-col gap-6 md:hidden">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unassigned</h3>
        <div className="flex flex-col gap-2">
          {unassigned.length === 0 ? (
            <p className="text-xs text-muted-foreground">None.</p>
          ) : (
            unassigned.map((wo) => (
              <button
                key={wo.id}
                type="button"
                onClick={() => onOpenWo(wo.id)}
                className={cn("rounded-lg border px-3 py-2 text-left text-sm", cardTone(wo.status))}
              >
                <p className="font-mono text-[10px] text-primary">
                  {getWorkOrderDisplay({ id: wo.id, workOrderNumber: wo.work_order_number ?? null })}
                </p>
                <p className="font-medium">{wo.title}</p>
                <p className="text-xs text-muted-foreground">{wo.customerName}</p>
              </button>
            ))
          )}
        </div>
      </section>

      {technicians.map((t) => {
        const list = byTech.get(t.id) ?? []
        return (
          <section key={t.id}>
            <h3 className="mb-2 truncate text-sm font-semibold text-foreground">{t.label}</h3>
            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing scheduled this day.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {list.map((wo) => (
                  <button
                    key={wo.id}
                    type="button"
                    onClick={() => onOpenWo(wo.id)}
                    className={cn("rounded-lg border px-3 py-2 text-left text-sm", cardTone(wo.status))}
                  >
                    <p className="text-[10px] text-muted-foreground">
                      {formatSlotLabel(timeToSlotIndex(wo.scheduled_time))}
                    </p>
                    <p className="font-mono text-[10px] text-primary">
                  {getWorkOrderDisplay({ id: wo.id, workOrderNumber: wo.work_order_number ?? null })}
                </p>
                    <p className="font-medium">{wo.title}</p>
                    <p className="text-xs text-muted-foreground">{wo.customerName}</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
