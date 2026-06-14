"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowRight, Flame, X } from "lucide-react"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { GrowthSignalFeedItem } from "@/lib/growth/signal-intelligence/signal-feed-types"
import {
  SIGNAL_FEED_FILTERS,
  SIGNAL_FEED_QA_MARKER,
  type SignalFeedFilter,
  type SignalFeedSortField,
} from "@/lib/growth/signal-intelligence/signal-feed-types"
import { cn } from "@/lib/utils"

const FILTER_LABELS: Record<SignalFeedFilter, string> = {
  new: "New",
  hot: "Hot",
  company: "Company",
  engagement: "Engagement",
  opportunity: "Opportunity",
  meeting: "Meeting",
  external: "External",
}

function priorityTone(priority: string): "critical" | "high" | "attention" | "neutral" {
  if (priority === "urgent") return "critical"
  if (priority === "high") return "high"
  if (priority === "medium") return "attention"
  return "neutral"
}

function statusLabel(status: string): string {
  if (status === "new") return "New"
  if (status === "viewed") return "Viewed"
  if (status === "acted_on") return "Acted on"
  if (status === "dismissed") return "Dismissed"
  return status
}

export function GrowthSignalFeedPanel({
  leadId,
  compact = false,
  title = "Signal Feed",
}: {
  leadId?: string | null
  compact?: boolean
  title?: string
}) {
  const [items, setItems] = useState<GrowthSignalFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<SignalFeedFilter | null>(null)
  const [sort, setSort] = useState<SignalFeedSortField>("occurred_at")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter) params.set("filter", filter)
      params.set("sort", sort)
      params.set("limit", compact ? "8" : "30")
      const base = leadId
        ? `/api/platform/growth/signals/feed/${encodeURIComponent(leadId)}`
        : "/api/platform/growth/signals/feed"
      const url = leadId ? `${base}?${params}` : `${base}?${params}`
      const res = await fetch(url, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        feed?: { items: GrowthSignalFeedItem[] }
      }
      setItems(res.ok && data.feed ? data.feed.items : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [compact, filter, leadId, sort])

  useEffect(() => {
    void load()
  }, [load])

  const applyAction = useCallback(
    async (auditEventId: string, action: "mark_viewed" | "mark_acted_on" | "dismiss") => {
      await fetch("/api/platform/growth/signals/feed/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_event_id: auditEventId, action }),
      })
      void load()
    },
    [load],
  )

  return (
    <GrowthEngineCard title={title} data-qa-marker={SIGNAL_FEED_QA_MARKER}>
      <p className="mb-3 text-xs text-muted-foreground">
        Routed signals with recommendations only — human approval required before any outreach or enrollment.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px]",
              filter === null ? "border-primary bg-primary/10" : "border-border",
            )}
            onClick={() => setFilter(null)}
          >
            All
          </button>
          {SIGNAL_FEED_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px]",
                filter === value ? "border-primary bg-primary/10" : "border-border",
              )}
              onClick={() => setFilter(value)}
            >
              {FILTER_LABELS[value]}
            </button>
          ))}
        </div>
        <select
          className="ml-auto rounded-md border bg-background px-2 py-1 text-[11px]"
          value={sort}
          onChange={(e) => setSort(e.target.value as SignalFeedSortField)}
        >
          <option value="occurred_at">Sort: Recent</option>
          <option value="confidence">Sort: Confidence</option>
          <option value="urgency">Sort: Urgency</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading signal feed…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No routed signals in feed window.</p>
      ) : (
        <ul className={cn("space-y-3", compact && "max-h-96 overflow-y-auto pr-1")}>
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-border/80 bg-muted/20 px-3 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.priority === "urgent" || item.priority === "high" ? (
                      <Flame className="h-3.5 w-3.5 text-amber-600" />
                    ) : null}
                    <p className="text-sm font-medium">{item.company_name ?? "Unknown company"}</p>
                    <GrowthBadge tone={priorityTone(item.priority)} label={item.signal_label} />
                    <GrowthBadge tone="neutral" label={statusLabel(item.status)} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.signal_type.replace(/_/g, " ")} · {Math.round(item.confidence * 100)}% confidence ·{" "}
                    {item.urgency} urgency
                  </p>
                </div>
                {item.status !== "dismissed" ? (
                  <button
                    type="button"
                    aria-label="Dismiss signal"
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                    onClick={() => void applyAction(item.audit_event_id, "dismiss")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="mt-2 rounded-md bg-background/70 px-2.5 py-2 text-xs">
                <p className="font-medium">{item.recommended_action}</p>
                <p className="mt-1 text-muted-foreground">{item.reasoning}</p>
                <p className="mt-1 font-medium text-emerald-800 dark:text-emerald-300">
                  {item.expected_impact}
                </p>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                {item.cta.view_lead ? (
                  <Link href={item.cta.view_lead} className="inline-flex items-center gap-1 text-primary">
                    View Lead <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : null}
                {item.cta.review_company ? (
                  <Link href={item.cta.review_company} className="inline-flex items-center gap-1 text-primary">
                    Review Company
                  </Link>
                ) : null}
                {item.cta.open_timeline ? (
                  <Link href={item.cta.open_timeline} className="inline-flex items-center gap-1 text-primary">
                    Open Timeline
                  </Link>
                ) : null}
                {item.cta.review_sequence ? (
                  <Link href={item.cta.review_sequence} className="inline-flex items-center gap-1 text-primary">
                    Review Sequence Recommendation
                  </Link>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {item.status === "new" ? (
                  <button
                    type="button"
                    className="rounded border px-2 py-0.5 text-[10px]"
                    onClick={() => void applyAction(item.audit_event_id, "mark_viewed")}
                  >
                    Mark viewed
                  </button>
                ) : null}
                {item.status !== "acted_on" && item.status !== "dismissed" ? (
                  <button
                    type="button"
                    className="rounded border px-2 py-0.5 text-[10px]"
                    onClick={() => void applyAction(item.audit_event_id, "mark_acted_on")}
                  >
                    Mark acted on
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

export function GrowthCommandHotSignalsSection({
  items,
}: {
  items: GrowthSignalFeedItem[]
}) {
  if (items.length === 0) return null

  return (
    <GrowthEngineCard title="Hot Signals" data-qa-marker={SIGNAL_FEED_QA_MARKER}>
      <p className="mb-3 text-xs text-muted-foreground">
        High-priority routed signals — recommendations only, no automatic execution.
      </p>
      <ul className="space-y-2">
        {items.slice(0, 6).map((item) => (
          <li key={item.id} className="rounded-lg border px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{item.company_name ?? "Unknown"}</span>
              <GrowthBadge tone={priorityTone(item.priority)} label={item.signal_label} />
            </div>
            <p className="mt-1 text-muted-foreground">{item.recommended_action}</p>
            <p className="mt-0.5 font-medium text-emerald-800 dark:text-emerald-300">{item.expected_impact}</p>
            {item.cta.view_lead ? (
              <Link href={item.cta.view_lead} className="mt-1 inline-flex items-center gap-1 text-primary">
                View Lead <ArrowRight className="h-3 w-3" />
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </GrowthEngineCard>
  )
}
