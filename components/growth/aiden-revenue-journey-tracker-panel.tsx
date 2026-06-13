"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, Circle, Loader2, Route } from "lucide-react"
import type { AidenRevenueJourneyTracker } from "@/lib/growth/aiden/aiden-revenue-journey-types"
import { AIDEN_REVENUE_JOURNEY_QA_MARKER } from "@/lib/growth/aiden/aiden-revenue-journey-types"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { cn } from "@/lib/utils"

export function useAidenRevenueJourney(limit = 25) {
  const [tracker, setTracker] = useState<AidenRevenueJourneyTracker | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/aiden/revenue-journey?limit=${limit}`, { cache: "no-store" })
      const data = (await res.json()) as { ok?: boolean; tracker?: AidenRevenueJourneyTracker; message?: string }
      if (!res.ok || !data.ok || !data.tracker) {
        throw new Error(data.message ?? "Failed to load revenue journey tracker")
      }
      setTracker(data.tracker)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setTracker(null)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { tracker, loading, error, refresh }
}

type AidenRevenueJourneyTrackerPanelProps = {
  className?: string
  embedded?: boolean
}

export function AidenRevenueJourneyTrackerPanel({ className, embedded }: AidenRevenueJourneyTrackerPanelProps) {
  const { tracker, loading, error, refresh } = useAidenRevenueJourney()

  const body = loading ? (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Loading pilot revenue journeys…
    </div>
  ) : error ? (
    <div className="space-y-2 text-sm">
      <p className="text-destructive">{error}</p>
      <button type="button" onClick={() => void refresh()} className="text-indigo-600 hover:underline">
        Retry
      </button>
    </div>
  ) : !tracker?.journeys.length ? (
    <p className="text-sm text-muted-foreground">No pilot leads found for revenue journey tracking.</p>
  ) : (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["email_sent", tracker.summary.email_sent],
            ["reply_received", tracker.summary.reply_received],
            ["meeting", tracker.summary.meeting],
            ["opportunity", tracker.summary.opportunity],
            ["revenue", tracker.summary.revenue],
          ] as const
        ).map(([key, count]) => (
          <GrowthBadge key={key} tone="neutral" className="text-xs">
            {key.replace(/_/g, " ")}: {count}/{tracker.summary.total_leads}
          </GrowthBadge>
        ))}
      </div>

      {tracker.journeys.map((journey) => (
        <div key={journey.lead_id} className="rounded-xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link
                href={`/admin/growth/leads?lead=${journey.lead_id}`}
                className="font-medium text-indigo-600 hover:underline"
              >
                {journey.company_name}
              </Link>
              <p className="mt-1 text-xs text-muted-foreground">
                Current stage: <span className="font-medium capitalize">{journey.current_stage.replace(/_/g, " ")}</span>
              </p>
            </div>
            <GrowthBadge tone={journey.missing_requirements.length === 0 ? "healthy" : "attention"}>
              {journey.stages.filter((stage) => stage.complete).length}/5
            </GrowthBadge>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            {journey.stages.map((stage) => (
              <Link
                key={stage.key}
                href={stage.deep_link ?? "#"}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs transition-colors hover:bg-muted/40",
                  stage.complete ? "border-emerald-200 bg-emerald-50/60" : "border-border bg-muted/20",
                )}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  {stage.complete ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Circle className="size-3.5 text-muted-foreground" />
                  )}
                  {stage.label}
                </div>
                {stage.detail ? <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{stage.detail}</p> : null}
              </Link>
            ))}
          </div>

          {journey.missing_requirements.length > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Missing: {journey.missing_requirements.join(" · ")}
            </p>
          ) : null}
          <p className="mt-2 text-xs font-medium text-foreground">{journey.recommended_next_action}</p>
        </div>
      ))}
    </div>
  )

  if (embedded) {
    return (
      <section className={className} data-aiden-revenue-journey={AIDEN_REVENUE_JOURNEY_QA_MARKER}>
        <div className="mb-3 flex items-center gap-2">
          <Route className="size-4 text-indigo-600" />
          <h3 className="text-sm font-semibold">Revenue Journey Tracker</h3>
        </div>
        {body}
      </section>
    )
  }

  return (
    <GrowthEngineCard
      className={className}
      title="Revenue Journey Tracker"
      description="Pilot lead progress from email send through closed revenue."
      icon={Route}
      data-aiden-revenue-journey={AIDEN_REVENUE_JOURNEY_QA_MARKER}
    >
      {body}
    </GrowthEngineCard>
  )
}
