"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { formatRelativeTime } from "@/components/growth/growth-ui-utils"
import type { GrowthLeadActivityStreamItem } from "@/lib/growth/engagement-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadActivityStreamProps = {
  lead: GrowthLead
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
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: GrowthLeadActivityStreamItem[]; message?: string }
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
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Engagement</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums">{lead.engagementScore ?? "—"}</span>
            {lead.engagementTier ? (
              <span className="text-sm font-semibold uppercase text-emerald-700">{lead.engagementTier}</span>
            ) : null}
          </div>
          {lead.engagementSummary ? <p className="mt-1 text-sm text-foreground">{lead.engagementSummary}</p> : null}
          {lead.engagementLastActivityAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Last activity {formatRelativeTime(lead.engagementLastActivityAt)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity stream</p>
        {loading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading activity…
          </div>
        ) : error ? (
          <p className="mt-3 text-sm text-rose-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.slice(0, 8).map((item) => (
              <li key={item.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.title}</span>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(item.occurredAt)}</span>
                </div>
                {item.summary ? <p className="mt-1 text-muted-foreground">{item.summary}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
