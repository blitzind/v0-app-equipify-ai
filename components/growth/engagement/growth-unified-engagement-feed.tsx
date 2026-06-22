"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowRight, Loader2, RefreshCw } from "lucide-react"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { Button } from "@/components/ui/button"
import {
  GE_V1_2_UNIFIED_ENGAGEMENT_READ_QA_MARKER,
  type GrowthUnifiedEngagementFeedPayload,
  type GrowthUnifiedEngagementRow,
} from "@/lib/growth/engagement/growth-unified-engagement-read-types"
import { cn } from "@/lib/utils"

const INTENSITY_TONE = {
  low: "neutral",
  medium: "medium",
  high: "attention",
  critical: "critical",
} as const

function formatWhen(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

function EngagementRow({ row }: { row: GrowthUnifiedEngagementRow }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{row.eventLabel}</p>
          <GrowthBadge label={row.intensity} tone={INTENSITY_TONE[row.intensity]} />
          <GrowthBadge label={row.source} tone="neutral" />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {[row.prospectName, row.companyName].filter(Boolean).join(" · ") || "Anonymous visitor"}
          {row.campaignOrPage ? ` · ${row.campaignOrPage}` : ""}
        </p>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">{formatWhen(row.occurredAt)}</p>
      </div>
      {row.recommendedAction && row.recommendedActionHref ? (
        <Link
          href={row.recommendedActionHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {row.recommendedAction}
          <ArrowRight className="size-3" />
        </Link>
      ) : null}
    </li>
  )
}

export function GrowthUnifiedEngagementFeed({ limit = 25 }: { limit?: number }) {
  const [feed, setFeed] = useState<GrowthUnifiedEngagementFeedPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/engagement/unified-feed?dateRange=last_7_days&limit=${limit}`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        feed?: GrowthUnifiedEngagementFeedPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.feed) {
        throw new Error(data.message ?? "Could not load unified engagement feed.")
      }
      setFeed(data.feed)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load unified engagement feed.")
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <GrowthEngineCard
      title="Unified engagement feed"
      data-section="unified-engagement-feed"
      data-qa-marker={GE_V1_2_UNIFIED_ENGAGEMENT_READ_QA_MARKER}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Prospects, pages, sends, video views, CTAs, bookings, and signals — one operator timeline.
        </p>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("mr-1 size-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {loading && !feed ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading engagement events…
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {feed && feed.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No engagement events in the last 7 days. Launch a campaign and monitor activity here.
        </p>
      ) : null}

      {feed && feed.rows.length > 0 ? (
        <ul>{feed.rows.map((row) => <EngagementRow key={row.id} row={row} />)}</ul>
      ) : null}
    </GrowthEngineCard>
  )
}
