"use client"

import { useCallback, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, ClipboardCopy, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { formatSlotLabel, timeToSlotIndex } from "@/lib/dispatch/board-utils"
import {
  orderStopsByManualList,
  sortStopsBySchedule,
  workOrderToRouteStop,
  type DispatchRouteStop,
} from "@/lib/dispatch/route-stops"
import type { DispatchTech } from "./dispatch-board"
import { useToast } from "@/hooks/use-toast"

function routeOrderStorageKey(techId: string, ymd: string) {
  return `equipify:dispatch:route-order:${techId}:${ymd}`
}

function loadSavedOrder(techId: string, ymd: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(routeOrderStorageKey(techId, ymd))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === "string")
  } catch {
    return []
  }
}

function saveOrder(techId: string, ymd: string, ids: string[]) {
  try {
    window.localStorage.setItem(routeOrderStorageKey(techId, ymd), JSON.stringify(ids))
  } catch {
    /* ignore quota */
  }
}

function StopRow({
  stop,
  position,
  onMoveUp,
  onMoveDown,
  disableUp,
  disableDown,
  onOpenWo,
}: {
  stop: DispatchRouteStop
  position: number
  onMoveUp: () => void
  onMoveDown: () => void
  disableUp: boolean
  disableDown: boolean
  onOpenWo: (id: string) => void
}) {
  const time =
    stop.scheduledTime != null && String(stop.scheduledTime).trim().length >= 5
      ? formatSlotLabel(timeToSlotIndex(stop.scheduledTime))
      : "—"
  const addr =
    [stop.addressLine1, [stop.city, stop.state].filter(Boolean).join(", "), stop.postalCode]
      .filter(Boolean)
      .join(" · ") || null

  return (
    <li className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
          {position + 1}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpenWo(stop.workOrderId)}
            className="w-full text-left"
          >
            <p className="font-mono text-[10px] text-primary">
              {getWorkOrderDisplay({
                id: stop.workOrderId,
                workOrderNumber: stop.workOrderNumber,
              })}
            </p>
            <p className="text-sm font-medium leading-snug text-foreground">{stop.customerName}</p>
            <p className="mt-0.5 flex items-start gap-1 text-[11px] text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0 opacity-70" aria-hidden />
              <span className="min-w-0">
                {stop.locationLabel ?? addr ?? "No site address on file"}
              </span>
            </p>
            {addr && stop.locationLabel ? (
              <p className="mt-0.5 text-[10px] text-muted-foreground/90">{addr}</p>
            ) : null}
          </button>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="rounded bg-muted px-1.5 py-px font-medium tabular-nums text-foreground">
              {time}
            </span>
            <span className="text-muted-foreground">{stop.status}</span>
            {stop.priority && stop.priority !== "normal" ? (
              <span className="rounded bg-amber-500/15 px-1.5 py-px font-medium text-amber-900 dark:text-amber-100">
                {stop.priority}
              </span>
            ) : null}
            {stop.fromServiceRequest ? (
              <span className="rounded bg-sky-500/15 px-1.5 py-px font-medium text-sky-800 dark:text-sky-200">
                Service request
              </span>
            ) : null}
            <span className="rounded bg-background px-1.5 py-px text-muted-foreground">
              {stop.workKind === "request" ? "request" : stop.workKind === "maintenance" ? "maint" : "repair"}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            className={cn(
              "rounded border border-border p-1 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              disableUp && "pointer-events-none opacity-30",
            )}
            aria-label="Move stop earlier in route"
            onClick={onMoveUp}
            disabled={disableUp}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(
              "rounded border border-border p-1 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              disableDown && "pointer-events-none opacity-30",
            )}
            aria-label="Move stop later in route"
            onClick={onMoveDown}
            disabled={disableDown}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  )
}

function TechnicianRouteColumn({
  tech,
  stops,
  selectedYmd,
  onOpenWo,
}: {
  tech: DispatchTech
  stops: DispatchRouteStop[]
  selectedYmd: string
  onOpenWo: (id: string) => void
}) {
  const { toast } = useToast()
  const [manualIds, setManualIds] = useState<string[]>(() => loadSavedOrder(tech.id, selectedYmd))

  const ordered = useMemo(() => {
    const base = sortStopsBySchedule(stops)
    const ids = manualIds.filter((id) => stops.some((s) => s.workOrderId === id))
    if (ids.length === 0) return base
    return orderStopsByManualList(base, ids)
  }, [stops, manualIds])

  const persist = useCallback(
    (next: string[]) => {
      setManualIds(next)
      saveOrder(tech.id, selectedYmd, next)
    },
    [tech.id, selectedYmd],
  )

  const move = useCallback(
    (idx: number, dir: -1 | 1) => {
      const list = ordered.map((s) => s.workOrderId)
      const j = idx + dir
      if (j < 0 || j >= list.length) return
      const copy = [...list]
      const t = copy[idx]!
      copy[idx] = copy[j]!
      copy[j] = t
      persist(copy)
    },
    [ordered, persist],
  )

  const resetOrder = useCallback(() => {
    persist([])
    toast({ title: "Route order reset", description: "Using scheduled time order." })
  }, [persist, toast])

  const copyPayload = useCallback(() => {
    void navigator.clipboard.writeText(JSON.stringify(ordered, null, 2))
    toast({ title: "Copied", description: "Map-ready stop list (JSON) for this technician." })
  }, [ordered, toast])

  if (stops.length === 0) return null

  return (
    <section className="rounded-xl border border-border bg-card/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{tech.label}</h3>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={resetOrder}
            className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            Reset order
          </button>
          <button
            type="button"
            onClick={() => void copyPayload()}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            <ClipboardCopy className="h-3 w-3" /> Copy JSON
          </button>
        </div>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Stops for {selectedYmd}. Reorder with arrows — saved per technician and day for quick field use. Latitude and
        longitude are reserved for future maps (null until geocoded).
      </p>
      <ol className="flex flex-col gap-2">
        {ordered.map((stop, idx) => (
          <StopRow
            key={stop.workOrderId}
            stop={stop}
            position={idx}
            onMoveUp={() => move(idx, -1)}
            onMoveDown={() => move(idx, 1)}
            disableUp={idx === 0}
            disableDown={idx === ordered.length - 1}
            onOpenWo={onOpenWo}
          />
        ))}
      </ol>
    </section>
  )
}

export function DispatchRouteView({
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
  const byTech = useMemo(() => {
    const m = new Map<string, DispatchRouteStop[]>()
    for (const t of technicians) m.set(t.id, [])
    for (const wo of workOrders) {
      if (!wo.assigned_user_id || wo.scheduled_on !== selectedYmd) continue
      const list = m.get(wo.assigned_user_id)
      if (!list) continue
      list.push(workOrderToRouteStop(wo))
    }
    for (const [, list] of m) {
      list.sort((a, b) => timeToSlotIndex(a.scheduledTime) - timeToSlotIndex(b.scheduledTime))
    }
    return m
  }, [workOrders, technicians, selectedYmd])

  const techsWithStops = useMemo(
    () => technicians.filter((t) => (byTech.get(t.id) ?? []).length > 0),
    [technicians, byTech],
  )

  if (techsWithStops.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/15 px-4 py-10 text-center">
        <MapPin className="mx-auto h-8 w-8 text-muted-foreground/40" aria-hidden />
        <p className="mt-2 text-sm font-medium text-foreground">No assigned stops this day</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Assign work to a technician for the selected day, or pick another day in the week strip.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {techsWithStops.map((t) => (
        <TechnicianRouteColumn
          key={`${t.id}-${selectedYmd}`}
          tech={t}
          stops={byTech.get(t.id) ?? []}
          selectedYmd={selectedYmd}
          onOpenWo={onOpenWo}
        />
      ))}
    </div>
  )
}
