"use client"

import { ListOrdered } from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  ProspectSearchWorkspaceQueueId,
  ProspectSearchWorkspaceQueueRollup,
} from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import { GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_UX_QA_MARKER,
  PROSPECT_SEARCH_WORKSPACE_QUEUES_TITLE,
} from "@/lib/growth/prospect-search/prospect-search-workspace-ux"

function QueueList({
  title,
  queues,
  selectedQueueId,
  onSelectQueue,
}: {
  title: string
  queues: ProspectSearchWorkspaceQueueRollup[]
  selectedQueueId?: ProspectSearchWorkspaceQueueId | null
  onSelectQueue?: (queueId: ProspectSearchWorkspaceQueueId) => void
}) {
  const active = queues.filter((q) => q.count > 0)
  if (active.length === 0) {
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">No accounts in these queues.</p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="mt-1.5 space-y-1.5">
        {queues.map((queue) => {
          const selected = selectedQueueId === queue.queue_id
          const RowTag = onSelectQueue ? "button" : "li"
          return (
            <RowTag
              key={queue.queue_id}
              type={onSelectQueue ? "button" : undefined}
              onClick={onSelectQueue ? () => onSelectQueue(queue.queue_id) : undefined}
              className={cn(
                "flex w-full items-start justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                selected
                  ? "border-slate-500 bg-slate-100"
                  : "border-slate-100 bg-white/80 hover:bg-slate-50",
                !onSelectQueue && "cursor-default",
              )}
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-950">{queue.label}</p>
                <p className="text-[10px] text-muted-foreground">{queue.description}</p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900">{queue.count}</span>
            </RowTag>
          )
        })}
      </ul>
    </div>
  )
}

export function ProspectSearchWorkspaceQueuesCard({
  researchQueues,
  coverageQueues,
  selectedQueueId,
  onSelectQueue,
  className,
}: {
  researchQueues: ProspectSearchWorkspaceQueueRollup[]
  coverageQueues: ProspectSearchWorkspaceQueueRollup[]
  selectedQueueId?: ProspectSearchWorkspaceQueueId | null
  onSelectQueue?: (queueId: ProspectSearchWorkspaceQueueId) => void
  className?: string
}) {
  return (
    <section
      className={className}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER}
      data-workspace-ux-marker={GROWTH_PROSPECT_SEARCH_WORKSPACE_UX_QA_MARKER}
      data-workspace-queues="v1"
    >
      <div className="flex items-center gap-2">
        <ListOrdered className="size-4 text-slate-800" />
        <h4 className="text-sm font-semibold text-slate-950">{PROSPECT_SEARCH_WORKSPACE_QUEUES_TITLE}</h4>
      </div>
      {onSelectQueue ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Select a queue to drive bulk execution preview (read-only).
        </p>
      ) : null}
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <QueueList
          title="Research queues (PS-D / PS-E)"
          queues={researchQueues}
          selectedQueueId={selectedQueueId}
          onSelectQueue={onSelectQueue}
        />
        <QueueList
          title="Coverage queues (PS-D / PS-E)"
          queues={coverageQueues}
          selectedQueueId={selectedQueueId}
          onSelectQueue={onSelectQueue}
        />
      </div>
    </section>
  )
}
