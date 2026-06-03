"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, History } from "lucide-react"
import { GrowthCollapsibleEngineCard, GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import {
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
  type GrowthRevenueTimelineEntry,
} from "@/lib/growth/revenue-execution/revenue-execution-types"

function categoryTone(category: GrowthRevenueTimelineEntry["category"]): "healthy" | "attention" | "warning" | "neutral" {
  if (category === "opportunity_recommendation" || category === "revenue_readiness") return "healthy"
  if (category === "review_action" || category === "playbook") return "attention"
  if (category === "execution_plan") return "warning"
  return "neutral"
}

export function GrowthRevenueTimelinePanel({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<GrowthRevenueTimelineEntry[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/platform/growth/revenue-execution/timeline?leadId=${encodeURIComponent(leadId)}`,
        { cache: "no-store" },
      )
      const payload = (await response.json()) as {
        timeline?: { qaMarker?: string; entries?: GrowthRevenueTimelineEntry[] }
      }
      if (response.ok && payload.timeline?.qaMarker === GROWTH_REVENUE_EXECUTION_QA_MARKER) {
        setEntries(payload.timeline.entries ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <GrowthCollapsibleEngineCard
      title="Revenue Workflow Timeline"
      icon={<History className="size-4" />}
      headerAside={entries.length ? `${entries.length} events` : "Unified view"}
      persistKey={GROWTH_DRAWER_CARD_KEYS.revenueTimeline}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading revenue timeline…
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No revenue workflow events yet.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-4">
          {entries.map((entry) => (
            <li key={entry.id} className="relative">
              <span className="absolute -left-[1.35rem] top-1.5 size-2 rounded-full bg-border" />
              <div className="flex flex-wrap items-center gap-2">
                <GrowthBadge label={entry.category.replace(/_/g, " ")} tone={categoryTone(entry.category)} />
                <time className="text-xs text-muted-foreground">
                  {new Date(entry.occurredAt).toLocaleString()}
                </time>
              </div>
              <p className="mt-1 text-sm font-medium">{entry.title}</p>
              {entry.summary ? <p className="text-sm text-muted-foreground">{entry.summary}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </GrowthCollapsibleEngineCard>
  )
}
