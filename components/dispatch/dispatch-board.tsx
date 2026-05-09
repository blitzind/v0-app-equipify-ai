"use client"

import { Fragment, useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import {
  DND,
  DISPATCH_SLOT_COUNT,
  formatSlotLabel,
  slotIndexToTimeHhMm,
  timeToSlotIndex,
} from "@/lib/dispatch/board-utils"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { TechnicianAvatar } from "@/components/technician/technician-avatar"
import { buildSchedulePatch } from "@/lib/work-orders/schedule-patch"
import type { OperationalBadge, OpsFlags } from "@/lib/dispatch/operational-badges"
import { OperationalBadgeRow } from "@/components/dispatch/operational-badge-row"
import {
  buildScheduleWarningsByPeer,
  type ScheduleWarningItem,
  type ScheduleWarnPeer,
} from "@/lib/dispatch/schedule-warnings"
import { AlertTriangle, Boxes, Clock, Info, Plus } from "lucide-react"

export type DispatchTech = {
  id: string
  label: string
  initials: string
  avatarUrl?: string | null
}

export type DispatchWoWorkKind = "maintenance" | "repair" | "request"

export type DispatchWo = {
  id: string
  title: string
  status: string
  scheduled_on: string | null
  scheduled_time: string | null
  assigned_user_id: string | null
  assigned_technician_id?: string | null
  customer_id: string
  customerLocationId?: string | null
  customerName: string
  work_order_number?: number | null
  priority?: string | null
  type?: string | null
  opsBadges: OperationalBadge[]
  opsFlags?: OpsFlags
  technicianLabel?: string | null
  /** Equipment or customer site line shown on cards */
  serviceLocationLabel?: string | null
  /** Customer site label when `customer_location_id` is set */
  siteLabel?: string | null
  addressLine1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  /** City, ST ZIP — for dispatch search/filter */
  geoLine?: string | null
  workKind: DispatchWoWorkKind
  fromServiceRequest: boolean
  createdByPmAutomation?: boolean
  latitude?: number | null
  longitude?: number | null
  /** Phase 1: explicit chip on dispatch card; falls back to 1 if join missing. */
  equipmentCount?: number
}

function cardTone(status: string): string {
  switch (status) {
    case "open":
      return "border-[color:var(--status-info)]/40 bg-[color:var(--status-info)]/12 text-foreground"
    case "scheduled":
      return "border-[color:var(--status-info)]/35 bg-[color:var(--status-info)]/15 text-foreground"
    case "in_progress":
      return "border-[color:var(--status-warning)]/40 bg-[color:var(--status-warning)]/12 text-foreground"
    case "completed":
      return "border-[color:var(--status-success)]/40 bg-[color:var(--status-success)]/12 text-foreground"
    case "invoiced":
      return "border-border bg-muted/50 text-muted-foreground"
    default:
      return "border-border bg-card text-foreground"
  }
}

function formatCardTimeLabel(scheduledTime: string | null): string | null {
  if (!scheduledTime) return null
  const head = scheduledTime.trim().slice(0, 5)
  if (head.length < 5) return null
  return formatSlotLabel(timeToSlotIndex(head))
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

function WoCard({
  wo,
  dragging,
  overlay,
  onOpen,
  slotOverlap,
  scheduleWarnings,
}: {
  wo: DispatchWo
  dragging?: boolean
  overlay?: boolean
  onOpen: (id: string) => void
  slotOverlap?: boolean
  /** Phase 35: soft checks (overlap may duplicate slot icon — still listed in tooltip). */
  scheduleWarnings?: ScheduleWarningItem[]
}) {
  const num = getWorkOrderDisplay({
    id: wo.id,
    workOrderNumber: wo.work_order_number ?? null,
  })
  const techMeta =
    wo.assigned_user_id && wo.technicianLabel ? wo.technicianLabel : null
  const locationMeta = wo.serviceLocationLabel?.trim() ?? null
  const priority = wo.priority?.trim() || "normal"
  const kindShort =
    wo.workKind === "request" ? "SR" : wo.workKind === "maintenance" ? "PM" : "RP"
  const equipmentChip =
    wo.equipmentCount && wo.equipmentCount > 0 ? wo.equipmentCount : null
  const timeLabel = formatCardTimeLabel(wo.scheduled_time)
  const warnTitle =
    scheduleWarnings && scheduleWarnings.length > 0
      ? scheduleWarnings.map((w) => w.message).join("\n")
      : undefined

  return (
    <button
      type="button"
      onClick={() => onOpen(wo.id)}
      title={warnTitle}
      className={cn(
        "w-full rounded-md border px-2 py-1.5 text-left text-xs shadow-sm transition-shadow",
        cardTone(wo.status),
        dragging && "opacity-40",
        overlay && "shadow-md ring-2 ring-primary/30",
        "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="flex items-start gap-1">
        <p className="min-w-0 flex-1 font-mono text-[10px] text-primary">{num}</p>
        {timeLabel ? (
          <span className="inline-flex items-center gap-0.5 shrink-0 rounded bg-background/60 px-1 text-[10px] font-medium text-foreground">
            <Clock className="h-2.5 w-2.5" />
            {timeLabel}
          </span>
        ) : null}
        {equipmentChip ? (
          <span
            className="inline-flex items-center gap-0.5 shrink-0 rounded bg-background/60 px-1 text-[10px] font-medium text-foreground"
            title={`${equipmentChip} equipment asset${equipmentChip > 1 ? "s" : ""}`}
          >
            <Boxes className="h-2.5 w-2.5" />
            {equipmentChip}
          </span>
        ) : null}
        {priority !== "normal" ? (
          <span
            className={cn(
              "shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tabular-nums",
              priority === "critical"
                ? "bg-rose-500/20 text-rose-800 dark:text-rose-200"
                : priority === "high"
                  ? "bg-amber-500/20 text-amber-900 dark:text-amber-100"
                  : "bg-muted text-muted-foreground",
            )}
            title="Priority"
          >
            {priority}
          </span>
        ) : null}
        {wo.fromServiceRequest ? (
          <span
            className="shrink-0 rounded bg-sky-500/15 px-1 py-px text-[9px] font-semibold text-sky-800 dark:text-sky-200"
            title="Originated from a service request"
          >
            Req
          </span>
        ) : null}
        <span
          className="shrink-0 rounded bg-background/60 px-1 py-px text-[9px] font-medium text-muted-foreground"
          title={wo.workKind === "request" ? "Request" : wo.workKind === "maintenance" ? "Maintenance" : "Repair"}
        >
          {kindShort}
        </span>
        {slotOverlap ? (
          <AlertTriangle
            className="h-3 w-3 shrink-0 text-[color:var(--status-warning)]"
            aria-label="Overlapping appointments"
          />
        ) : null}
        {!slotOverlap && scheduleWarnings && scheduleWarnings.length > 0 ? (
          <Info
            className="h-3 w-3 shrink-0 text-muted-foreground"
            aria-label="Scheduling notes"
          />
        ) : null}
      </div>
      <p className="line-clamp-2 font-medium leading-snug">{wo.title}</p>
      <p className="truncate text-[10px] text-muted-foreground">{wo.customerName}</p>
      {techMeta || locationMeta ? (
        <p className="truncate text-[10px] text-muted-foreground">
          {[techMeta, locationMeta].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {scheduleWarnings && scheduleWarnings.length > 0 ? (
        <p className="mt-1 line-clamp-2 text-[9px] leading-snug text-muted-foreground">
          {scheduleWarnings[0]!.message}
          {scheduleWarnings.length > 1 ? ` (+${scheduleWarnings.length - 1})` : ""}
        </p>
      ) : null}
      <OperationalBadgeRow badges={wo.opsBadges ?? []} className="mt-1" />
    </button>
  )
}

function DraggableWo({
  wo,
  onOpen,
  slotOverlap,
  scheduleWarnings,
}: {
  wo: DispatchWo
  onOpen: (id: string) => void
  slotOverlap?: boolean
  scheduleWarnings?: ScheduleWarningItem[]
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: DND.wo(wo.id),
    data: { wo },
  })
  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "touch-none select-none",
        isDragging ? "cursor-grabbing" : "cursor-grab",
      )}
    >
      <WoCard
        wo={wo}
        dragging={isDragging}
        onOpen={onOpen}
        slotOverlap={slotOverlap}
        scheduleWarnings={scheduleWarnings}
      />
    </div>
  )
}

function DroppableSlot({
  techId,
  slotIdx,
  children,
  onQuickAdd,
  isEmpty,
}: {
  techId: string
  slotIdx: number
  children: React.ReactNode
  onQuickAdd?: () => void
  isEmpty?: boolean
}) {
  const id = DND.cell(techId, slotIdx)
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group min-h-[52px] border-b border-border/50 p-1 transition-colors relative",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/40",
      )}
    >
      <div className="flex flex-col gap-1">{children}</div>
      {onQuickAdd && isEmpty ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onQuickAdd()
          }}
          className={cn(
            "absolute inset-0 m-1 hidden items-center justify-center rounded border border-dashed border-primary/30 bg-primary/5 text-[10px] font-medium text-primary/70",
            "group-hover:flex",
          )}
          aria-label="Quick add at this slot"
        >
          <Plus className="h-3 w-3 mr-0.5" /> Add
        </button>
      ) : null}
    </div>
  )
}

function DroppablePool({ children }: { children: React.ReactNode }) {
  const id = DND.pool()
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[120px] rounded-lg border border-dashed border-border bg-muted/20 p-2 transition-colors",
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      {children}
    </div>
  )
}

function groupAssignedForDay(
  orders: DispatchWo[],
  selectedYmd: string,
): Map<string, DispatchWo[]> {
  const map = new Map<string, DispatchWo[]>()
  for (const wo of orders) {
    if (!wo.assigned_user_id || wo.scheduled_on !== selectedYmd) continue
    const slotIdx = timeToSlotIndex(wo.scheduled_time)
    const key = `${wo.assigned_user_id}@@${slotIdx}`
    const arr = map.get(key) ?? []
    arr.push(wo)
    map.set(key, arr)
  }
  return map
}

export function DispatchBoard({
  technicians,
  workOrders,
  selectedYmd,
  onOpenWo,
  onMoveWo,
  busy,
  onQuickAdd,
}: {
  technicians: DispatchTech[]
  workOrders: DispatchWo[]
  selectedYmd: string
  onOpenWo: (id: string) => void
  onMoveWo: (args: {
    woId: string
    assignedUserId: string | null
    scheduledOn: string
    scheduledTimeHhMm: string | null
  }) => Promise<void>
  busy?: boolean
  /**
   * Phase 1: optional quick-create entry point. When provided, the board
   * renders an "+ Quick add" button on the Unassigned section and on each
   * technician column header, prefilling date/time/tech.
   */
  onQuickAdd?: (args: {
    technicianId: string | null
    scheduledOn: string
    scheduledTimeHhMm: string | null
  }) => void
}) {
  const [activeWo, setActiveWo] = useState<DispatchWo | null>(null)

  // Phase 4: separate Pointer + Touch sensors. Pointer uses a small distance
  // threshold so mouse drag still feels snappy; Touch uses a short long-press
  // delay so list scrolling on mobile is not hijacked into a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  )

  const unassigned = useMemo(
    () => workOrders.filter((w) => !w.assigned_user_id && ["open", "scheduled", "in_progress"].includes(w.status)),
    [workOrders],
  )

  const assignedMap = useMemo(
    () => groupAssignedForDay(workOrders, selectedYmd),
    [workOrders, selectedYmd],
  )

  const workloadByTech = useMemo(() => {
    const m = new Map<string, number>()
    for (const wo of workOrders) {
      if (!wo.assigned_user_id || wo.scheduled_on !== selectedYmd) continue
      const uid = wo.assigned_user_id
      m.set(uid, (m.get(uid) ?? 0) + 1)
    }
    return m
  }, [workOrders, selectedYmd])

  const warnPeers = useMemo(() => workOrders.map(toWarnPeer), [workOrders])
  const scheduleWarningsByWoId = useMemo(
    () => buildScheduleWarningsByPeer(warnPeers),
    [warnPeers],
  )

  const overdueByTech = useMemo(() => {
    const m = new Map<string, number>()
    for (const wo of workOrders) {
      if (!wo.assigned_user_id || wo.scheduled_on !== selectedYmd) continue
      if (!wo.opsFlags?.sched_past_due) continue
      const uid = wo.assigned_user_id
      m.set(uid, (m.get(uid) ?? 0) + 1)
    }
    return m
  }, [workOrders, selectedYmd])

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    const woId = DND.parseWo(id)
    if (!woId) return
    const wo = workOrders.find((w) => w.id === woId) ?? null
    setActiveWo(wo)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveWo(null)
    const woId = DND.parseWo(String(e.active.id))
    const overId = e.over?.id != null ? String(e.over.id) : null
    if (!woId || !overId || busy) return

    if (DND.isPool(overId)) {
      await onMoveWo({
        woId,
        assignedUserId: null,
        scheduledOn: selectedYmd,
        scheduledTimeHhMm: null,
      })
      return
    }

    const cell = DND.parseCell(overId)
    if (cell) {
      const hhmm = slotIndexToTimeHhMm(cell.slotIdx)
      await onMoveWo({
        woId,
        assignedUserId: cell.techId,
        scheduledOn: selectedYmd,
        scheduledTimeHhMm: hhmm,
      })
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={(ev) => void handleDragEnd(ev)}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Unassigned work — sticky on tall viewports so it stays in reach */}
        <section className="w-full shrink-0 space-y-2 lg:sticky lg:top-2 lg:w-72 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
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
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                aria-label="Quick add unassigned work order"
                disabled={busy}
              >
                <Plus className="h-3 w-3" /> Quick add
              </button>
            ) : null}
          </div>
          <DroppablePool>
            {unassigned.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                <p className="text-xs font-medium text-foreground">Inbox is clear.</p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Drag any tech card here to release a job back to the queue, or use{" "}
                  <span className="font-medium text-foreground">Quick add</span> to drop a new
                  appointment in.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {unassigned.map((wo) => (
                  <DraggableWo
                    key={wo.id}
                    wo={wo}
                    onOpen={onOpenWo}
                    scheduleWarnings={scheduleWarningsByWoId.get(wo.id)}
                  />
                ))}
              </div>
            )}
          </DroppablePool>
        </section>

        {/* Technician schedule */}
        <section className="min-w-0 flex-1 space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
            Technician schedule
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {technicians.length} {technicians.length === 1 ? "tech" : "techs"}
            </span>
          </h3>
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          {technicians.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No technicians in roster. Invite team members with the technician role to build the dispatch grid.
            </div>
          ) : (
            <div
              className="grid min-w-[720px]"
              style={{
                gridTemplateColumns: `72px repeat(${technicians.length}, minmax(160px, 1fr))`,
              }}
            >
              <div className="sticky top-0 z-10 border-b border-border ds-thead-bg px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Time
              </div>
              {technicians.map((t) => {
                const load = workloadByTech.get(t.id) ?? 0
                const overdue = overdueByTech.get(t.id) ?? 0
                return (
                  <div
                    key={t.id}
                    className="sticky top-0 z-10 border-b border-l border-border ds-thead-bg px-2 py-2"
                  >
                    {/* Row 1: name + load chip + add — easier to scan than the
                        old single-line cramming of avatar/name/(count)/+. */}
                    <div className="flex items-center gap-2">
                      <TechnicianAvatar
                        userId={t.id}
                        name={t.label}
                        initials={t.initials}
                        avatarUrl={t.avatarUrl}
                        size="xs"
                      />
                      <span
                        className="truncate text-xs font-semibold text-foreground"
                        title={t.label}
                      >
                        {t.label}
                      </span>
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
                          className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded border border-border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                          aria-label={`Quick add for ${t.label}`}
                          disabled={busy}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                    {/* Row 2: lightweight workload indicator. */}
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                          load === 0
                            ? "bg-muted text-muted-foreground"
                            : load >= 6
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                              : load >= 3
                                ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
                                : "bg-sky-500/15 text-sky-700 dark:text-sky-300",
                        )}
                        title={`${load} job${load === 1 ? "" : "s"} on selected day`}
                      >
                        {load} {load === 1 ? "job" : "jobs"}
                      </span>
                      {overdue > 0 ? (
                        <span
                          className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-amber-900 dark:text-amber-100"
                          title={`${overdue} overdue scheduled (past appointment day)`}
                        >
                          {overdue} late
                        </span>
                      ) : null}
                    </div>
                  </div>
                )
              })}

              {Array.from({ length: DISPATCH_SLOT_COUNT }, (_, slotIdx) => (
                <Fragment key={slotIdx}>
                  <div className="border-b border-border/60 bg-muted/10 px-2 py-2 text-[10px] text-muted-foreground">
                    {formatSlotLabel(slotIdx)}
                  </div>
                  {technicians.map((tech) => {
                    const cellKey = `${tech.id}@@${slotIdx}`
                    const list = assignedMap.get(cellKey) ?? []
                    return (
                      <DroppableSlot
                        key={`${tech.id}-${slotIdx}`}
                        techId={tech.id}
                        slotIdx={slotIdx}
                        isEmpty={list.length === 0}
                        onQuickAdd={
                          onQuickAdd
                            ? () =>
                                onQuickAdd({
                                  technicianId: tech.id,
                                  scheduledOn: selectedYmd,
                                  scheduledTimeHhMm: slotIndexToTimeHhMm(slotIdx),
                                })
                            : undefined
                        }
                      >
                        {list.map((wo) => (
                          <DraggableWo
                            key={wo.id}
                            wo={wo}
                            onOpen={onOpenWo}
                            slotOverlap={list.length > 1}
                            scheduleWarnings={scheduleWarningsByWoId.get(wo.id)}
                          />
                        ))}
                      </DroppableSlot>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          )}
          </div>
        </section>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeWo ? (
          <WoCard
            wo={activeWo}
            overlay
            onOpen={() => {}}
            scheduleWarnings={scheduleWarningsByWoId.get(activeWo.id)}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export { buildSchedulePatch }
