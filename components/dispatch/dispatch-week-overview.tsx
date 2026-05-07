"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { addDays, startOfWeekMonday, toYmd } from "@/lib/dispatch/board-utils"
import type { DispatchTech, DispatchWo } from "@/components/dispatch/dispatch-board"

/**
 * Phase 1: lightweight weekly overview row above the dispatch board.
 *
 * Shows assignment density per technician × weekday so dispatchers can
 * quickly spot light/heavy days. Cells are clickable to jump the active day.
 *
 * Additive — does not replace the dispatch board day grid. Operates on
 * already-loaded `DispatchWo` rows.
 */
export function DispatchWeekOverview({
  technicians,
  workOrders,
  weekAnchor,
  selectedYmd,
  onSelectYmd,
  className,
}: {
  technicians: DispatchTech[]
  workOrders: DispatchWo[]
  weekAnchor: Date
  selectedYmd: string
  onSelectYmd: (ymd: string) => void
  className?: string
}) {
  const weekStart = useMemo(() => startOfWeekMonday(weekAnchor), [weekAnchor])
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )
  const dayYmds = useMemo(() => days.map((d) => toYmd(d)), [days])
  const dayKeys = useMemo(() => new Set(dayYmds), [dayYmds])

  const counts = useMemo(() => {
    const m = new Map<string, Map<string, number>>()
    const totalsByDay = new Map<string, number>()
    const unassignedByDay = new Map<string, number>()
    for (const t of technicians) m.set(t.id, new Map())
    for (const wo of workOrders) {
      if (!wo.scheduled_on) continue
      const ymd = wo.scheduled_on.slice(0, 10)
      if (!dayKeys.has(ymd)) continue
      totalsByDay.set(ymd, (totalsByDay.get(ymd) ?? 0) + 1)
      if (!wo.assigned_user_id) {
        unassignedByDay.set(ymd, (unassignedByDay.get(ymd) ?? 0) + 1)
        continue
      }
      const techMap = m.get(wo.assigned_user_id)
      if (!techMap) continue
      techMap.set(ymd, (techMap.get(ymd) ?? 0) + 1)
    }
    return { byTech: m, totalsByDay, unassignedByDay }
  }, [technicians, workOrders, dayKeys])

  const todayYmd = toYmd(new Date())

  if (technicians.length === 0) return null

  return (
    <div className={cn("rounded-lg border border-border bg-card overflow-x-auto", className)}>
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Week overview
        </p>
        <p className="text-[10px] text-muted-foreground">
          Click a day to jump · totals shown below each weekday
        </p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/60">
            <th className="text-left font-medium text-muted-foreground px-3 py-2 w-[160px] sticky left-0 bg-card z-10">
              Technician
            </th>
            {days.map((d) => {
              const ymd = toYmd(d)
              const isSel = ymd === selectedYmd
              const isToday = ymd === todayYmd
              return (
                <th
                  key={ymd}
                  className={cn(
                    "text-center font-medium px-1.5 py-1.5 cursor-pointer select-none",
                    isSel
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/40",
                  )}
                  onClick={() => onSelectYmd(ymd)}
                >
                  <div className="flex flex-col items-center gap-0">
                    <span className={cn("uppercase tracking-wide text-[10px]", isToday && !isSel && "text-primary")}>
                      {d.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span className={cn("text-sm font-semibold", isToday && !isSel && "text-primary")}>
                      {d.getDate()}
                    </span>
                    <span className={cn("text-[10px] tabular-nums", isSel ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {counts.totalsByDay.get(ymd) ?? 0} job
                      {(counts.totalsByDay.get(ymd) ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {(counts.unassignedByDay.size > 0 ? [null, ...technicians] : technicians).map((t) => {
            const isUnassignedRow = t === null
            return (
              <tr
                key={isUnassignedRow ? "__unassigned__" : (t as DispatchTech).id}
                className="border-b border-border/30 last:border-0"
              >
                <td className="px-3 py-1.5 text-foreground/80 truncate max-w-[160px] sticky left-0 bg-card z-10 border-r border-border/30">
                  {isUnassignedRow ? (
                    <span className="font-medium text-muted-foreground">Unassigned</span>
                  ) : (
                    (t as DispatchTech).label
                  )}
                </td>
                {dayYmds.map((ymd) => {
                  const n = isUnassignedRow
                    ? counts.unassignedByDay.get(ymd) ?? 0
                    : counts.byTech.get((t as DispatchTech).id)?.get(ymd) ?? 0
                  const isSel = ymd === selectedYmd
                  return (
                    <td
                      key={`${isUnassignedRow ? "u" : (t as DispatchTech).id}-${ymd}`}
                      className={cn(
                        "text-center align-middle py-1.5 px-1.5 cursor-pointer select-none",
                        isSel ? "bg-primary/10" : "hover:bg-muted/40",
                      )}
                      onClick={() => onSelectYmd(ymd)}
                    >
                      {n === 0 ? (
                        <span className="text-muted-foreground/40 tabular-nums">·</span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center justify-center min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                            isUnassignedRow
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                              : n >= 6
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                                : n >= 3
                                  ? "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30"
                                  : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30",
                          )}
                        >
                          {n}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
