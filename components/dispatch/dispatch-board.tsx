"use client"

import { Fragment, useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
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

export type DispatchTech = {
  id: string
  label: string
  initials: string
  avatarUrl?: string | null
}

export type DispatchWo = {
  id: string
  title: string
  status: string
  scheduled_on: string | null
  scheduled_time: string | null
  assigned_user_id: string | null
  customer_id: string
  customerName: string
  work_order_number?: number | null
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

function WoCard({
  wo,
  dragging,
  overlay,
  onOpen,
}: {
  wo: DispatchWo
  dragging?: boolean
  overlay?: boolean
  onOpen: (id: string) => void
}) {
  const num = getWorkOrderDisplay({
    id: wo.id,
    workOrderNumber: wo.work_order_number ?? null,
  })
  return (
    <button
      type="button"
      onClick={() => onOpen(wo.id)}
      className={cn(
        "w-full rounded-md border px-2 py-1.5 text-left text-xs shadow-sm transition-shadow",
        cardTone(wo.status),
        dragging && "opacity-40",
        overlay && "shadow-md ring-2 ring-primary/30",
        "cursor-grab active:cursor-grabbing",
      )}
    >
      <p className="font-mono text-[10px] text-primary">{num}</p>
      <p className="line-clamp-2 font-medium leading-snug">{wo.title}</p>
      <p className="truncate text-[10px] text-muted-foreground">{wo.customerName}</p>
    </button>
  )
}

function DraggableWo({
  wo,
  onOpen,
}: {
  wo: DispatchWo
  onOpen: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: DND.wo(wo.id),
    data: { wo },
  })
  const style = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` }
    : undefined

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-none">
      <WoCard wo={wo} dragging={isDragging} onOpen={onOpen} />
    </div>
  )
}

function DroppableSlot({
  techId,
  slotIdx,
  children,
}: {
  techId: string
  slotIdx: number
  children: React.ReactNode
}) {
  const id = DND.cell(techId, slotIdx)
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[52px] border-b border-border/50 p-1 transition-colors",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/25",
      )}
    >
      <div className="flex flex-col gap-1">{children}</div>
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
}) {
  const [activeWo, setActiveWo] = useState<DispatchWo | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
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
        {/* Unassigned */}
        <section className="w-full shrink-0 space-y-2 lg:w-72">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Unassigned</h3>
          <DroppablePool>
            {unassigned.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No unassigned jobs.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {unassigned.map((wo) => (
                  <DraggableWo key={wo.id} wo={wo} onOpen={onOpenWo} />
                ))}
              </div>
            )}
          </DroppablePool>
        </section>

        {/* Grid */}
        <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          {technicians.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No technicians in roster. Invite team members with the technician role to build the dispatch grid.
            </div>
          ) : (
            <div
              className="grid min-w-[720px]"
              style={{
                gridTemplateColumns: `72px repeat(${technicians.length}, minmax(140px, 1fr))`,
              }}
            >
              <div className="sticky top-0 z-10 border-b border-border bg-muted/40 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Time
              </div>
              {technicians.map((t) => (
                <div
                  key={t.id}
                  className="sticky top-0 z-10 border-b border-l border-border bg-muted/40 px-2 py-2"
                >
                  <div className="flex items-center gap-2">
                    <TechnicianAvatar
                      userId={t.id}
                      name={t.label}
                      initials={t.initials}
                      avatarUrl={t.avatarUrl}
                      size="xs"
                    />
                    <span className="truncate text-xs font-semibold text-foreground">{t.label}</span>
                  </div>
                </div>
              ))}

              {Array.from({ length: DISPATCH_SLOT_COUNT }, (_, slotIdx) => (
                <Fragment key={slotIdx}>
                  <div className="border-b border-border/60 bg-muted/10 px-2 py-2 text-[10px] text-muted-foreground">
                    {formatSlotLabel(slotIdx)}
                  </div>
                  {technicians.map((tech) => {
                    const cellKey = `${tech.id}@@${slotIdx}`
                    const list = assignedMap.get(cellKey) ?? []
                    return (
                      <DroppableSlot key={`${tech.id}-${slotIdx}`} techId={tech.id} slotIdx={slotIdx}>
                        {list.map((wo) => (
                          <DraggableWo key={wo.id} wo={wo} onOpen={onOpenWo} />
                        ))}
                      </DroppableSlot>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeWo ? <WoCard wo={activeWo} overlay onOpen={() => {}} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

export { buildSchedulePatch }
