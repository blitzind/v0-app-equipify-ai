"use client"

import { useState } from "react"
import { ChevronDown, History, Loader2 } from "lucide-react"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { formatInboxDate } from "@/components/growth/inbox/growth-inbox-shared-ui"
import { inboxTimelineEventTypeLabel } from "@/lib/growth/inbox/inbox-timeline-labels"
import { GROWTH_INBOX_WORKSPACE_PHASE2_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

export function GrowthInboxRelationshipTimeline() {
  const { leadId, loading, timeline } = useGrowthInboxLeadContext()
  const [open, setOpen] = useState(false)

  if (!leadId) return null

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="shrink-0 border-t border-border/60 bg-muted/5"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE2_QA_MARKER}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-muted/20">
        <div className="flex items-center gap-1.5">
          <History className="size-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Relationship Timeline
          </span>
          {!loading ? (
            <span className="text-[10px] text-muted-foreground">({timeline.length})</span>
          ) : null}
        </div>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open ? "rotate-180" : "")} />
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-border/40 px-3 pb-2">
        {loading ? (
          <div className="flex items-center gap-2 py-1 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Loading timeline…
          </div>
        ) : timeline.length === 0 ? (
          <p className="py-1 text-[11px] text-muted-foreground">No timeline events for this lead yet.</p>
        ) : (
          <ul className="max-h-32 space-y-1 overflow-y-auto pt-1 text-[11px]">
            {timeline.map((entry) => (
              <li key={entry.id} className="rounded border border-border/50 bg-card/80 px-2 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{inboxTimelineEventTypeLabel(entry.eventKind)}</span>
                  <span className="shrink-0 text-[9px] text-muted-foreground">{formatInboxDate(entry.occurredAt)}</span>
                </div>
                <p className="truncate text-muted-foreground">{entry.summary || entry.title}</p>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
