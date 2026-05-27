"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Layers, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import {
  channelTypeLabel,
  taskStatusLabel,
  type GrowthSequenceChannelTask,
} from "@/lib/growth/multichannel/multichannel-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadMultichannelTimelinePanelProps = {
  lead: GrowthLead
}

export function GrowthLeadMultichannelTimelinePanel({ lead }: GrowthLeadMultichannelTimelinePanelProps) {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<GrowthSequenceChannelTask[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/platform/growth/multichannel/tasks?leadId=${encodeURIComponent(lead.id)}`,
        { cache: "no-store" },
      )
      const payload = (await response.json()) as { tasks?: GrowthSequenceChannelTask[] }
      if (response.ok) setTasks(payload.tasks ?? [])
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    void load()
  }, [load])

  const collapsedSummary = loading ? "Loading…" : `${tasks.length} channel tasks`

  return (
    <GrowthCollapsibleEngineCard
      title="Multi-Channel Timeline"
      icon={<Layers className="size-4" />}
      headerAside={collapsedSummary}
      persistKey={GROWTH_DRAWER_CARD_KEYS.multichannelTimeline}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading channel timeline…
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No multi-channel tasks for this account.</p>
      ) : (
        <div className="space-y-2">
          {tasks.slice(0, 8).map((task) => (
            <div key={task.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <GrowthBadge label={channelTypeLabel(task.channel)} tone="attention" />
                <GrowthBadge label={taskStatusLabel(task.status)} tone="medium" />
                <span className="font-medium">{task.title}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {task.callWorkspaceHref ? (
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link href={task.callWorkspaceHref}>Call Workspace</Link>
                  </Button>
                ) : null}
                {task.bookingIntelligenceHref ? (
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link href={task.bookingIntelligenceHref}>Booking Intelligence</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </GrowthCollapsibleEngineCard>
  )
}
