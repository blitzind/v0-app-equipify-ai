"use client"

import { History, Loader2 } from "lucide-react"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { formatInboxDate } from "@/components/growth/inbox/growth-inbox-shared-ui"
import { inboxTimelineEventTypeLabel } from "@/lib/growth/inbox/inbox-timeline-labels"
import { GROWTH_INBOX_WORKSPACE_PHASE2_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"
import { GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER } from "@/lib/growth/reply-intelligence/reply-intent-types"

export function GrowthInboxRelationshipTimeline() {
  const { leadId, loading, timeline } = useGrowthInboxLeadContext()

  if (!leadId) return null

  return (
    <section
      className="border-b border-border px-4 py-3"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE2_QA_MARKER}
      aria-label="Relationship timeline"
    >
      <div className="mb-2 flex items-center gap-2">
        <History className="size-4 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">Relationship Timeline</h3>
        <span className="text-[10px] text-muted-foreground" data-equipify-qa-marker={GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER}>
          {GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Loading timeline…
        </div>
      ) : timeline.length === 0 ? (
        <p className="text-xs text-muted-foreground">No timeline events for this lead yet.</p>
      ) : (
        <ul className="max-h-56 space-y-2 overflow-y-auto pr-1 text-xs">
          {timeline.map((entry) => (
            <li key={entry.id} className="rounded-md border border-border/70 bg-muted/10 px-2 py-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{inboxTimelineEventTypeLabel(entry.eventKind)}</span>
                <span className="text-[10px] text-muted-foreground">{formatInboxDate(entry.occurredAt)}</span>
              </div>
              <p className="mt-0.5 text-muted-foreground">{entry.summary || entry.title}</p>
              {entry.evidenceExcerpt ? (
                <p className="mt-1 text-[10px] italic text-muted-foreground">"{entry.evidenceExcerpt}"</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
