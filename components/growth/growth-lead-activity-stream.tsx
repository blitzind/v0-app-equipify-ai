"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, History, Loader2 } from "lucide-react"
import { GrowthBadge, GrowthCollapsibleEngineCard, formatRelativeTime } from "@/components/growth/growth-ui-utils"
import type { GrowthLeadActivityStreamItem } from "@/lib/growth/engagement-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadActivityStreamProps = {
  lead: GrowthLead
}

function EngagementSummary({ lead }: { lead: GrowthLead }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums text-foreground">{lead.engagementScore ?? "—"}</span>
        {lead.engagementTier ? <GrowthBadge label={lead.engagementTier} tone="healthy" /> : null}
      </div>
      {lead.engagementSummary ? <p className="text-sm text-foreground">{lead.engagementSummary}</p> : null}
      {lead.engagementLastActivityAt ? (
        <p className="text-xs text-muted-foreground">
          Last activity {formatRelativeTime(lead.engagementLastActivityAt)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">No engagement activity recorded yet.</p>
      )}
    </div>
  )
}

export function GrowthLeadActivityStream({ lead }: GrowthLeadActivityStreamProps) {
  const [items, setItems] = useState<GrowthLeadActivityStreamItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/activity-stream`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        items?: GrowthLeadActivityStreamItem[]
        message?: string
      }
      if (!res.ok || !data.ok || !data.items) {
        throw new Error(data.message ?? "Could not load activity stream.")
      }
      setItems(data.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <GrowthCollapsibleEngineCard
        title="Engagement"
        icon={<Activity className="size-4" />}
        headerAside={
          <>
            <span className="text-sm font-semibold tabular-nums text-foreground">{lead.engagementScore ?? "—"}</span>
            {lead.engagementTier ? <GrowthBadge label={lead.engagementTier} tone="healthy" /> : null}
          </>
        }
      >
        <EngagementSummary lead={lead} />
      </GrowthCollapsibleEngineCard>

      <GrowthCollapsibleEngineCard title="Activity Stream" icon={<History className="size-4" />}>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading activity…
          </div>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            No recent activity.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.slice(0, 8).map((item) => (
              <li key={item.id} className="rounded-lg border border-border/80 bg-muted/15 px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-foreground">{item.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(item.occurredAt)}</span>
                </div>
                {item.summary ? <p className="mt-1 text-muted-foreground">{item.summary}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </GrowthCollapsibleEngineCard>
    </div>
  )
}
