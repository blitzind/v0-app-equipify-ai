"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, Loader2 } from "lucide-react"
import { GrowthBadge, GrowthCollapsibleEngineCard, formatRelativeTime } from "@/components/growth/growth-ui-utils"
import type { GrowthLead } from "@/lib/growth/types"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type { GrowthLeadTrackingDetail } from "@/lib/growth/tracking/tracking-types"

type GrowthLeadEngagementProps = {
  lead: GrowthLead
}

export function GrowthLeadEngagement({ lead }: GrowthLeadEngagementProps) {
  const [detail, setDetail] = useState<GrowthLeadTrackingDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const loadDetail = useCallback(async () => {
    if (loaded) return
    setLoading(true)
    try {
      const res = await fetch(`/api/platform/growth/engagement?lead_id=${encodeURIComponent(lead.id)}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: GrowthLeadTrackingDetail }
      if (res.ok && data.ok && data.detail) {
        setDetail(data.detail)
      }
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [lead.id, loaded])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const score = detail?.score?.score ?? lead.engagementScore
  const tier = detail?.score?.tier ?? lead.engagementTier

  return (
    <GrowthCollapsibleEngineCard
      title="Engagement"
      icon={<Activity className="size-4" />}
      headerAside={
        <>
          <span className="text-sm font-semibold tabular-nums text-foreground">{score ?? "—"}</span>
          {tier ? <GrowthBadge label={tier} tone="healthy" /> : null}
        </>
      }
      defaultOpen={false}
      persistKey={GROWTH_DRAWER_CARD_KEYS.engagement}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-foreground">{score ?? "—"}</span>
          {tier ? <GrowthBadge label={tier} tone="healthy" /> : null}
        </div>
        {lead.engagementSummary ? <p className="text-sm text-foreground">{lead.engagementSummary}</p> : null}
        {lead.engagementLastActivityAt ? (
          <p className="text-xs text-muted-foreground">
            Last activity {formatRelativeTime(lead.engagementLastActivityAt)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No engagement activity recorded yet.</p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Loading attribution detail…
          </div>
        ) : null}

        {detail ? (
          <>
            <div className="grid gap-2 sm:grid-cols-4 text-sm">
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-muted-foreground">Opens</p>
                <p className="font-semibold tabular-nums">{detail.score?.opens ?? detail.opens.length}</p>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-muted-foreground">Clicks</p>
                <p className="font-semibold tabular-nums">{detail.score?.clicks ?? detail.clicks.length}</p>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-muted-foreground">Replies</p>
                <p className="font-semibold tabular-nums">{detail.score?.replies ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="text-muted-foreground">Meetings</p>
                <p className="font-semibold tabular-nums">{detail.score?.meetings ?? 0}</p>
              </div>
            </div>

            {detail.timeline.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Activity timeline</p>
                <ul className="space-y-2">
                  {detail.timeline.slice(0, 8).map((item) => (
                    <li key={item.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{item.title}</span>
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(item.occurredAt)}</span>
                      </div>
                      {item.summary ? <p className="text-muted-foreground">{item.summary}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {detail.opens.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Open history</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {detail.opens.slice(0, 5).map((open) => (
                    <li key={open.id}>
                      {formatRelativeTime(open.openedAt)}
                      {open.deviceType ? ` · ${open.deviceType}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {detail.clicks.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Click history</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {detail.clicks.slice(0, 5).map((click) => (
                    <li key={click.id}>
                      {formatRelativeTime(click.clickedAt)} · {click.destinationUrl.replace(/^https?:\/\//, "").slice(0, 48)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}
