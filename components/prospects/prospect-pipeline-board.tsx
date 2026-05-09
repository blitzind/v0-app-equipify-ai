"use client"

import { useMemo, useState } from "react"
import { GripVertical, Mail, Phone } from "lucide-react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import type { ProspectListItem, ProspectStatus } from "@/lib/prospects/types"
import { PIPELINE_STAGE_ORDER } from "@/lib/prospects/types"
import {
  formatEstimatedValue,
  formatFollowUpStamp,
  formatProspectStatus,
  prospectStatusBadgeClasses,
} from "@/lib/prospects/format"
import { followUpBucketFor } from "@/lib/prospects/format"
import { Badge } from "@/components/ui/badge"

function resolveDropStage(
  overId: UniqueIdentifier | null | undefined,
  prospects: ProspectListItem[],
): ProspectStatus | null {
  if (overId == null) return null
  const sid = String(overId)
  if (PIPELINE_STAGE_ORDER.includes(sid as ProspectStatus)) return sid as ProspectStatus
  const hit = prospects.find((p) => p.id === sid)
  return hit?.status ?? null
}

function daysSinceCreated(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)))
}

function PipelineCard({
  prospect,
  dragging,
  canManage,
  onOpen,
}: {
  prospect: ProspectListItem
  dragging?: boolean
  canManage: boolean
  onOpen: (p: ProspectListItem) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: prospect.id,
    data: { prospect },
    disabled: !canManage,
  })

  const bucket = followUpBucketFor(prospect.next_follow_up_at)
  const fuTone =
    bucket === "overdue"
      ? "text-rose-700 dark:text-rose-300"
      : bucket === "today"
        ? "text-amber-700 dark:text-amber-300"
        : "text-muted-foreground"

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const ageDays = daysSinceCreated(prospect.created_at)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex w-full gap-1 rounded-lg border border-border bg-card shadow-sm transition-[box-shadow,transform,border-color]",
        "hover:border-primary/35 hover:shadow-md",
        (isDragging || dragging) && "opacity-70 shadow-xl ring-2 ring-primary/35 scale-[1.01]",
      )}
    >
      <button
        type="button"
        className={cn(
          "touch-none shrink-0 rounded-l-lg px-1.5 py-3 text-muted-foreground hover:bg-muted/60",
          !canManage && "cursor-default opacity-40",
        )}
        {...(canManage ? listeners : {})}
        {...(canManage ? attributes : {})}
        aria-label="Drag to move stage"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="min-w-0 flex-1 flex flex-col rounded-r-lg">
        <button
          type="button"
          onClick={() => onOpen(prospect)}
          className="flex-1 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-tr-lg"
        >
          <p className="text-sm font-semibold leading-snug line-clamp-2">{prospect.company_name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", prospectStatusBadgeClasses(prospect.status))}>
              {formatProspectStatus(prospect.status)}
            </Badge>
            {prospect.converted_customer_id ? (
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-800 dark:text-emerald-200">
                Customer
              </Badge>
            ) : null}
            {bucket === "overdue" ? (
              <Badge
                variant="outline"
                className="text-[10px] border-rose-500/40 text-rose-800 dark:text-rose-200 font-semibold"
              >
                Follow-up overdue
              </Badge>
            ) : null}
            {ageDays != null && ageDays >= 14 ? (
              <Badge variant="outline" className="text-[10px] border-amber-500/35 text-amber-900 dark:text-amber-100">
                {ageDays}d in pipeline
              </Badge>
            ) : null}
          </div>
          <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
            <p className="tabular-nums">{formatEstimatedValue(prospect.estimated_value_cents)}</p>
            {prospect.assigned_to_label ? (
              <p>
                Owner: <span className="text-foreground font-medium">{prospect.assigned_to_label}</span>
              </p>
            ) : null}
            {prospect.next_action_owner_label ? (
              <p>
                Next action: <span className="text-foreground font-medium">{prospect.next_action_owner_label}</span>
              </p>
            ) : null}
            <p className={cn("tabular-nums", fuTone)}>
              Next F/U: {prospect.next_follow_up_at ? formatFollowUpStamp(prospect.next_follow_up_at) : "—"}
            </p>
          </div>
        </button>
        {(prospect.contact_email || prospect.contact_phone) && (
          <div className="flex items-center gap-1 px-3 pb-2 pt-0 border-t border-border/60">
            {prospect.contact_email ? (
              <a
                href={`mailto:${encodeURIComponent(prospect.contact_email)}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Email"
                onClick={(e) => e.stopPropagation()}
              >
                <Mail className="w-3.5 h-3.5" aria-hidden />
              </a>
            ) : null}
            {prospect.contact_phone ? (
              <a
                href={`tel:${prospect.contact_phone.replace(/\s+/g, "")}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Call"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="w-3.5 h-3.5" aria-hidden />
              </a>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

function StageColumn({
  stage,
  prospects,
  totalCents,
  canManage,
  onOpen,
}: {
  stage: ProspectStatus
  prospects: ProspectListItem[]
  totalCents: number
  canManage: boolean
  onOpen: (p: ProspectListItem) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
    disabled: !canManage,
  })

  const dollars = totalCents / 100
  const avgAge =
    prospects.length === 0
      ? null
      : Math.round(
          prospects.reduce((acc, p) => acc + (daysSinceCreated(p.created_at) ?? 0), 0) / prospects.length,
        )

  return (
    <div className="flex min-w-[min(100vw-2rem,280px)] max-w-[320px] shrink-0 flex-col rounded-xl border border-border bg-muted/20">
      <div className="border-b border-border px-3 py-2.5">
        <p className="text-xs font-semibold leading-tight">{formatProspectStatus(stage)}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
          {prospects.length} lead{prospects.length === 1 ? "" : "s"} ·{" "}
          {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
            dollars,
          )}
          {avgAge != null ? (
            <>
              {" "}
              · avg {avgAge}d old
            </>
          ) : null}
        </p>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[200px] flex-1 flex-col gap-2 p-2 sm:min-h-[240px] transition-colors rounded-b-xl",
          isOver && canManage && "bg-primary/[0.07] ring-2 ring-inset ring-primary/30",
        )}
      >
        {prospects.map((p) => (
          <PipelineCard key={p.id} prospect={p} canManage={canManage} onOpen={onOpen} />
        ))}
        {prospects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/30 px-2 py-8 text-center">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              No prospects here. Drag a card from another column or add a lead from the table.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export type ProspectPipelineBoardProps = {
  prospects: ProspectListItem[]
  canManage: boolean
  onOpen: (p: ProspectListItem) => void
  onPipelinePatch: (prospectId: string, status: ProspectStatus) => Promise<boolean>
}

export function ProspectPipelineBoard({
  prospects,
  canManage,
  onOpen,
  onPipelinePatch,
}: ProspectPipelineBoardProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const columns = useMemo(() => {
    const map = new Map<ProspectStatus, ProspectListItem[]>()
    for (const s of PIPELINE_STAGE_ORDER) map.set(s, [])
    for (const p of prospects) {
      const list = map.get(p.status)
      if (list) list.push(p)
    }
    return map
  }, [prospects])

  const totals = useMemo(() => {
    const map = new Map<ProspectStatus, number>()
    for (const s of PIPELINE_STAGE_ORDER) {
      const sum = (columns.get(s) ?? []).reduce((acc, p) => acc + (p.estimated_value_cents ?? 0), 0)
      map.set(s, sum)
    }
    return map
  }, [columns])

  const activeProspect = activeId ? prospects.find((p) => p.id === String(activeId)) : undefined

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    if (!canManage) return
    const prospectId = String(event.active.id)
    const nextStage = resolveDropStage(event.over?.id, prospects)
    if (!nextStage) return
    const prev = prospects.find((p) => p.id === prospectId)
    if (!prev || prev.status === nextStage) return
    await onPipelinePatch(prospectId, nextStage)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={(e) => void handleDragEnd(e)}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-3 pt-1 -mx-1 px-1 scroll-smooth touch-pan-x">
        {PIPELINE_STAGE_ORDER.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            prospects={columns.get(stage) ?? []}
            totalCents={totals.get(stage) ?? 0}
            canManage={canManage}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeProspect ? (
          <div className="w-[min(100vw-2rem,280px)] opacity-[0.97] rotate-[0.5deg]">
            <PipelineCard prospect={activeProspect} dragging canManage={canManage} onOpen={onOpen} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
