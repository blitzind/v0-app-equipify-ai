"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  capTimelineEvents,
  groupTimelineEvents,
  type TimelineEventLike,
} from "@/lib/voice/workspace-context/timeline-simplification"
import { realtimeUpdateCap } from "@/lib/voice/workspace-context/performance-controls"
import type { VoiceWorkspaceMode } from "@/lib/voice/workspace-context/types"
import type { VoiceCallRecordingVisibilityView } from "@/lib/voice/browser-calling/types"

export function GrowthCallWorkspaceSimplifiedTimeline({
  timeline,
  recording,
  browserCallStateLabel,
  workspaceMode = "idle",
}: {
  timeline: TimelineEventLike[]
  recording: VoiceCallRecordingVisibilityView | null
  browserCallStateLabel: string | null
  workspaceMode?: VoiceWorkspaceMode
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const capped = capTimelineEvents(timeline, realtimeUpdateCap(workspaceMode))
  const groups = groupTimelineEvents(capped)

  if (groups.length === 0 && !recording && !browserCallStateLabel) return null

  function toggleGroup(groupKey: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  return (
    <div
      className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2 text-sm dark:border-white/5"
      data-qa-action="call-workspace-simplified-timeline"
    >
      {browserCallStateLabel ? (
        <p className="text-xs text-muted-foreground">
          Voice state: <span className="font-medium text-foreground">{browserCallStateLabel}</span>
        </p>
      ) : null}
      {groups.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {groups.map((group) => {
            const expanded = expandedGroups.has(group.groupKey) || group.eventCount === 1
            return (
              <li key={group.groupKey} className="rounded-md border border-border/40 px-2 py-1.5 dark:border-white/5">
                <div className="flex items-center gap-1">
                  {group.eventCount > 1 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => toggleGroup(group.groupKey)}
                    >
                      {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    </Button>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{group.label}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{group.summary}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(group.latestAt).toLocaleTimeString()}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
      {recording ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Recording: {recording.durationSeconds ?? "—"}s · {recording.playbackPlaceholder}
        </p>
      ) : null}
    </div>
  )
}
