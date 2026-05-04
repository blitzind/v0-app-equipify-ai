"use client"

import { useDraggable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { getWorkOrderDisplay } from "@/lib/work-orders/display"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GripVertical, Loader2, Sparkles } from "lucide-react"

export type UnassignedQueueRow = {
  id: string
  work_order_number?: number | null
  customerName: string
  jobTypeLabel: string
  priorityLabel: string
  scheduledLabel: string
  regionLine: string
  estHoursLabel: string
}

export function queuedWoDragId(woId: string) {
  return `qwo@@${woId}`
}

function priorityBarClass(priority: string) {
  if (priority === "Critical") return "bg-destructive"
  if (priority === "High") return "bg-[color:var(--status-warning)]"
  if (priority === "Low") return "bg-[color:var(--status-success)]"
  return "bg-muted-foreground"
}

function PriorityDot({ priority }: { priority: string }) {
  return <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", priorityBarClass(priority))} />
}

function DraggableQueueCard({
  row,
  suggestionChips,
  onAssign,
  assignBusy,
}: {
  row: UnassignedQueueRow
  suggestionChips: { id: string; name: string; reasons: string[] }[]
  onAssign: () => void
  assignBusy: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: queuedWoDragId(row.id),
    data: { woId: row.id },
  })
  const style = transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined

  const disp = getWorkOrderDisplay({
    id: row.id,
    workOrderNumber: row.work_order_number ?? null,
  })

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden shadow-sm",
        isDragging && "opacity-50 ring-2 ring-primary/25 z-10",
      )}
    >
      <div className={cn("h-1 w-full", priorityBarClass(row.priorityLabel))} />
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="mt-0.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing touch-none shrink-0"
            aria-label="Drag to assign"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] text-primary">{disp}</span>
              <Badge variant="outline" className="text-[10px] font-normal">
                {row.jobTypeLabel}
              </Badge>
            </div>
            <p className="text-sm font-semibold text-foreground truncate mt-0.5">{row.customerName}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1">
                <PriorityDot priority={row.priorityLabel} />
                {row.priorityLabel}
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span>{row.scheduledLabel}</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{row.estHoursLabel}</span>
            </div>
            {row.regionLine ? (
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{row.regionLine}</p>
            ) : null}
          </div>
        </div>

        {suggestionChips.length > 0 ? (
          <div className="flex flex-col gap-1.5 pl-1 border-t border-border/60 pt-2">
            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3 w-3" /> Suggestions
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestionChips.map((s) => (
                <span
                  key={s.id}
                  title={s.reasons.join(" · ")}
                  className="inline-flex items-center rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-foreground"
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          size="sm"
          className="w-full gap-1.5 cursor-pointer"
          disabled={assignBusy}
          onClick={onAssign}
        >
          {assignBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Assign
        </Button>
      </div>
    </div>
  )
}

export function UnassignedJobsQueue({
  loading,
  rows,
  suggestionsByWoId,
  assigningWoId,
  onAssign,
}: {
  loading: boolean
  rows: UnassignedQueueRow[]
  suggestionsByWoId: Record<string, { id: string; name: string; reasons: string[] }[]>
  assigningWoId: string | null
  onAssign: (woId: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading unassigned jobs…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center rounded-xl border border-dashed border-border bg-muted/10 px-3">
        No unassigned open work orders.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3 max-h-[min(420px,55vh)] overflow-y-auto pr-1">
      {rows.map((row) => (
        <DraggableQueueCard
          key={row.id}
          row={row}
          suggestionChips={suggestionsByWoId[row.id] ?? []}
          assignBusy={assigningWoId === row.id}
          onAssign={() => onAssign(row.id)}
        />
      ))}
    </div>
  )
}
