"use client"

import { ListOrdered } from "lucide-react"
import type { ProspectSearchWorkspaceQueueRollup } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import { GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_UX_QA_MARKER,
  PROSPECT_SEARCH_WORKSPACE_QUEUES_TITLE,
} from "@/lib/growth/prospect-search/prospect-search-workspace-ux"

function QueueList({ title, queues }: { title: string; queues: ProspectSearchWorkspaceQueueRollup[] }) {
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
        {queues.map((queue) => (
          <li
            key={queue.queue_id}
            className="flex items-start justify-between gap-2 rounded-md border border-slate-100 bg-white/80 px-2 py-1.5 text-xs"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-950">{queue.label}</p>
              <p className="text-[10px] text-muted-foreground">{queue.description}</p>
            </div>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">{queue.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ProspectSearchWorkspaceQueuesCard({
  researchQueues,
  coverageQueues,
  className,
}: {
  researchQueues: ProspectSearchWorkspaceQueueRollup[]
  coverageQueues: ProspectSearchWorkspaceQueueRollup[]
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
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <QueueList title="Research queues (PS-D / PS-E)" queues={researchQueues} />
        <QueueList title="Coverage queues (PS-D / PS-E)" queues={coverageQueues} />
      </div>
    </section>
  )
}
