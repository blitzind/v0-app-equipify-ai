"use client"

import { useMemo } from "react"
import { Boxes, CalendarPlus, Plus, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import type { DispatchTech, DispatchWo } from "./dispatch-board"
import { OperationalBadgeRow } from "@/components/dispatch/operational-badge-row"
import { Checkbox } from "@/components/ui/checkbox"
import { formatSlotLabel, timeToSlotIndex } from "@/lib/dispatch/board-utils"
import {
  buildScheduleWarningsByPeer,
  type ScheduleWarnPeer,
} from "@/lib/dispatch/schedule-warnings"

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

function toWarnPeer(w: DispatchWo): ScheduleWarnPeer {
  return {
    id: w.id,
    status: w.status,
    scheduled_on: w.scheduled_on,
    scheduled_time: w.scheduled_time,
    assigned_user_id: w.assigned_user_id,
    customer_id: w.customer_id,
    customerLocationId: w.customerLocationId ?? null,
    opsFlags: w.opsFlags ?? null,
  }
}

export function DispatchMobileList({
  technicians,
  workOrders,
  selectedYmd,
  onOpenWo,
  onQuickAdd,
  bulkSelection,
}: {
  technicians: DispatchTech[]
  workOrders: DispatchWo[]
  selectedYmd: string
  onOpenWo: (id: string) => void
  onQuickAdd?: (args: {
    technicianId: string | null
    scheduledOn: string
    scheduledTimeHhMm: string | null
  }) => void
  bulkSelection?: { selectedIds: string[]; onToggle: (id: string) => void } | null
}) {
  const unassigned = useMemo(
    () => workOrders.filter((w) => !w.assigned_user_id && ["open", "scheduled", "in_progress"].includes(w.status)),
    [workOrders],
  )

  const scheduleWarningsByWoId = useMemo(() => {
    const peers = workOrders.map(toWarnPeer)
    return buildScheduleWarningsByPeer(peers)
  }, [workOrders])

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
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
            Unassigned work
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {unassigned.length}
            </span>
          </h3>
          {onQuickAdd ? (
            <button
              type="button"
              onClick={() =>
                onQuickAdd({ technicianId: null, scheduledOn: selectedYmd, scheduledTimeHhMm: null })
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:border-primary/40 hover:text-primary min-h-[36px]"
              aria-label="Quick add unassigned"
            >
              <Plus className="h-3.5 w-3.5" /> Quick add
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          {unassigned.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
              <CalendarPlus className="mx-auto h-6 w-6 text-muted-foreground/60" />
              <p className="mt-2 text-xs font-medium text-foreground">Inbox is clear</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                No unassigned work today. Tap{" "}
                <span className="font-medium text-foreground">Quick add</span> to queue a new
                appointment.
              </p>
              {onQuickAdd ? (
                <button
                  type="button"
                  onClick={() =>
                    onQuickAdd({
                      technicianId: null,
                      scheduledOn: selectedYmd,
                      scheduledTimeHhMm: null,
                    })
                  }
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary min-h-[36px]"
                >
                  <Plus className="h-3.5 w-3.5" /> Quick add appointment
                </button>
              ) : null}
            </div>
          ) : (
            unassigned.map((wo) => (
              <div
                key={wo.id}
                className={cn(
                  "flex gap-2 rounded-lg border px-2 py-2.5 text-sm sm:px-3",
                  cardTone(wo.status),
                )}
              >
                {bulkSelection ? (
                  <label
                    className="flex shrink-0 cursor-pointer items-center self-stretch pt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={bulkSelection.selectedIds.includes(wo.id)}
                      onCheckedChange={() => bulkSelection.onToggle(wo.id)}
                      className="size-5"
                      aria-label={`Select work order ${wo.work_order_number ?? wo.id.slice(0, 8)}`}
                    />
                  </label>
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onOpenWo(wo.id)}
                  className="flex flex-col gap-1 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[10px] text-primary">
                      {getWorkOrderDisplay({ id: wo.id, workOrderNumber: wo.work_order_number ?? null })}
                    </p>
                    {wo.equipmentCount && wo.equipmentCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Boxes className="h-3 w-3" />
                        {wo.equipmentCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="font-medium">{wo.title}</p>
                  <p className="text-xs text-muted-foreground">{wo.customerName}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {wo.priority && wo.priority !== "normal" ? (
                      <span className="rounded bg-muted px-1 py-px text-[10px] font-medium text-foreground">
                        {wo.priority}
                      </span>
                    ) : null}
                    {wo.fromServiceRequest ? (
                      <span className="rounded bg-sky-500/15 px-1 py-px text-[10px] font-medium text-sky-800 dark:text-sky-200">
                        SR
                      </span>
                    ) : null}
                    <span className="rounded bg-background/80 px-1 py-px text-[10px] text-muted-foreground">
                      {wo.workKind === "request"
                        ? "Request"
                        : wo.workKind === "maintenance"
                          ? "Maint"
                          : "Repair"}
                    </span>
                  </div>
                  {wo.assigned_user_id && wo.technicianLabel ? (
                    <p className="truncate text-[10px] text-muted-foreground">
                      {wo.technicianLabel}
                      {wo.serviceLocationLabel ? ` · ${wo.serviceLocationLabel}` : ""}
                    </p>
                  ) : wo.serviceLocationLabel ? (
                    <p className="truncate text-[10px] text-muted-foreground">{wo.serviceLocationLabel}</p>
                  ) : null}
                  {(() => {
                    const sw = scheduleWarningsByWoId.get(wo.id)
                    if (!sw?.length) return null
                    return (
                      <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                        {sw[0]!.message}
                        {sw.length > 1 ? ` (+${sw.length - 1})` : ""}
                      </p>
                    )
                  })()}
                  <OperationalBadgeRow badges={wo.opsBadges ?? []} className="mt-1.5" />
                </button>
                {/* Phase: Scheduling Field-Speed Polish — quick actions row.
                    Direct path to schedule the unassigned job from mobile. */}
                {onQuickAdd ? (
                  <div className="flex items-center gap-1.5 border-t border-border/40 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        onQuickAdd({
                          technicianId: null,
                          scheduledOn: selectedYmd,
                          scheduledTimeHhMm: null,
                        })
                      }
                      className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-medium text-foreground hover:border-primary/40 hover:text-primary"
                      aria-label="Schedule like this one"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" /> Schedule similar
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenWo(wo.id)}
                      className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-[11px] font-medium text-foreground hover:border-primary/40 hover:text-primary"
                      aria-label="Open to assign technician"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Assign
                    </button>
                  </div>
                ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {technicians.map((t) => {
        const list = byTech.get(t.id) ?? []
        return (
          <section key={t.id}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-foreground">
                <span className="truncate" title={t.label}>{t.label}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {list.length}
                </span>
              </h3>
              {onQuickAdd ? (
                <button
                  type="button"
                  onClick={() =>
                    onQuickAdd({ technicianId: t.id, scheduledOn: selectedYmd, scheduledTimeHhMm: null })
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:border-primary/40 hover:text-primary min-h-[36px]"
                  aria-label={`Quick add for ${t.label}`}
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              ) : null}
            </div>
            {list.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/15 px-3 py-4 text-center">
                <p className="text-[11px] text-muted-foreground">
                  Nothing scheduled this day for{" "}
                  <span className="font-medium text-foreground">{t.label.split(" ")[0]}</span>.
                </p>
                {onQuickAdd ? (
                  <button
                    type="button"
                    onClick={() =>
                      onQuickAdd({
                        technicianId: t.id,
                        scheduledOn: selectedYmd,
                        scheduledTimeHhMm: null,
                      })
                    }
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary min-h-[36px]"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" /> Drop a job here
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {list.map((wo) => (
                  <div
                    key={wo.id}
                    className={cn(
                      "flex gap-2 rounded-lg border px-2 py-2 text-sm sm:px-3",
                      cardTone(wo.status),
                    )}
                  >
                    {bulkSelection ? (
                      <label
                        className="flex shrink-0 cursor-pointer items-center self-stretch"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={bulkSelection.selectedIds.includes(wo.id)}
                          onCheckedChange={() => bulkSelection.onToggle(wo.id)}
                          className="size-5"
                          aria-label={`Select work order ${wo.work_order_number ?? wo.id.slice(0, 8)}`}
                        />
                      </label>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onOpenWo(wo.id)}
                      className="min-w-0 flex-1 px-0 py-0 text-left"
                    >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">
                        {formatSlotLabel(timeToSlotIndex(wo.scheduled_time))}
                      </p>
                      {wo.equipmentCount && wo.equipmentCount > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Boxes className="h-3 w-3" />
                          {wo.equipmentCount}
                        </span>
                      ) : null}
                    </div>
                    <p className="font-mono text-[10px] text-primary">
                      {getWorkOrderDisplay({ id: wo.id, workOrderNumber: wo.work_order_number ?? null })}
                    </p>
                    <p className="font-medium">{wo.title}</p>
                    <p className="text-xs text-muted-foreground">{wo.customerName}</p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {wo.priority && wo.priority !== "normal" ? (
                        <span className="rounded bg-muted px-1 py-px text-[10px] font-medium text-foreground">
                          {wo.priority}
                        </span>
                      ) : null}
                      {wo.fromServiceRequest ? (
                        <span className="rounded bg-sky-500/15 px-1 py-px text-[10px] font-medium text-sky-800 dark:text-sky-200">
                          SR
                        </span>
                      ) : null}
                      <span className="rounded bg-background/80 px-1 py-px text-[10px] text-muted-foreground">
                        {wo.workKind === "request"
                          ? "Request"
                          : wo.workKind === "maintenance"
                            ? "Maint"
                            : "Repair"}
                      </span>
                    </div>
                    {wo.technicianLabel ? (
                      <p className="truncate text-[10px] text-muted-foreground">
                        {wo.technicianLabel}
                        {wo.serviceLocationLabel ? ` · ${wo.serviceLocationLabel}` : ""}
                      </p>
                    ) : wo.serviceLocationLabel ? (
                      <p className="truncate text-[10px] text-muted-foreground">{wo.serviceLocationLabel}</p>
                    ) : null}
                    {(() => {
                      const sw = scheduleWarningsByWoId.get(wo.id)
                      if (!sw?.length) return null
                      return (
                        <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                          {sw[0]!.message}
                          {sw.length > 1 ? ` (+${sw.length - 1})` : ""}
                        </p>
                      )
                    })()}
                    <OperationalBadgeRow badges={wo.opsBadges ?? []} className="mt-1.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
