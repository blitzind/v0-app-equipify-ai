"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Copy, Eye, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  readAttributionRecLifecycle,
  setAttributionRecLifecycle,
  type GrowthAttributionRecLifecycleMap,
} from "@/lib/growth/revenue-attribution/attribution-recommendation-lifecycle"
import {
  GROWTH_ATTRIBUTION_RECOMMENDATION_SAFETY_NOTES,
  GROWTH_REVENUE_ATTRIBUTION_RECOMMENDATIONS_QA_MARKER,
  recommendationTypeLabel,
  type GrowthAttributionRecommendation,
  type GrowthRevenueAttributionRecommendationsPayload,
} from "@/lib/growth/revenue-attribution/attribution-recommendation-types"
import type { GrowthAttributionModel } from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types"

type Props = {
  attributionModel: GrowthAttributionModel
  channel: string
  repUserId: string
  sequenceId: string
}

function RecommendationCard({
  rec,
  lifecycle,
  onLifecycle,
  onViewDetails,
}: {
  rec: GrowthAttributionRecommendation
  lifecycle: GrowthAttributionRecLifecycleMap
  onLifecycle: (id: string, state: "reviewed" | "dismissed") => void
  onViewDetails: (rec: GrowthAttributionRecommendation) => void
}) {
  const state = lifecycle[rec.id]?.state ?? "active"
  if (state === "dismissed") return null

  const [copied, setCopied] = useState(false)

  async function copyRec(): Promise<void> {
    const text = [
      rec.title,
      rec.explanation,
      `Action: ${rec.recommendedAction}`,
      `Confidence: ${rec.confidence}%`,
      ...rec.evidence.map((e) => `${e.label}: ${e.value}`),
      rec.safetyNotes,
    ].join("\n")
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`rounded-lg border p-4 space-y-2 ${state === "reviewed" ? "border-border/40 opacity-80" : "border-border/70"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{rec.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {recommendationTypeLabel(rec.recommendationType)} · {rec.dimensionLabel} · {rec.confidence}% confidence
          </p>
        </div>
        {state === "reviewed" ? <GrowthBadge label="Reviewed" tone="neutral" /> : null}
      </div>
      <p className="text-sm text-muted-foreground">{rec.explanation}</p>
      <ul className="text-xs text-muted-foreground space-y-0.5">
        {rec.evidence.slice(0, 4).map((e) => (
          <li key={`${e.label}-${e.value}`}>
            {e.label}: <span className="text-foreground">{e.value}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs italic text-muted-foreground">{rec.safetyNotes}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={() => onViewDetails(rec)}>
          <Eye className="size-3.5 mr-1" /> View details
        </Button>
        <Button size="sm" variant="outline" onClick={() => void copyRec()}>
          <Copy className="size-3.5 mr-1" /> {copied ? "Copied" : "Copy"}
        </Button>
        {state !== "reviewed" ? (
          <Button size="sm" variant="outline" onClick={() => onLifecycle(rec.id, "reviewed")}>
            <Check className="size-3.5 mr-1" /> Mark reviewed
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => onLifecycle(rec.id, "dismissed")}>
          <X className="size-3.5 mr-1" /> Dismiss
        </Button>
      </div>
    </div>
  )
}

export function GrowthRevenueAttributionRecommendationsSection({
  attributionModel,
  channel,
  repUserId,
  sequenceId,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<GrowthRevenueAttributionRecommendationsPayload | null>(null)
  const [lifecycle, setLifecycle] = useState<GrowthAttributionRecLifecycleMap>({})
  const [detailRec, setDetailRec] = useState<GrowthAttributionRecommendation | null>(null)

  useEffect(() => {
    setLifecycle(readAttributionRecLifecycle())
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ attribution_model: attributionModel })
      if (channel.trim()) params.set("channel", channel.trim())
      if (repUserId.trim()) params.set("rep_user_id", repUserId.trim())
      if (sequenceId.trim()) params.set("sequence_id", sequenceId.trim())

      const response = await fetch(
        `/api/platform/growth/revenue-attribution/recommendations?${params}`,
        { cache: "no-store" },
      )
      const body = (await response.json()) as {
        ok?: boolean
        recommendations?: GrowthRevenueAttributionRecommendationsPayload
        message?: string
      }
      if (!response.ok || !body.ok || !body.recommendations) {
        throw new Error(body.message ?? "Could not load recommendations.")
      }
      setPayload(body.recommendations)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load recommendations.")
    } finally {
      setLoading(false)
    }
  }, [attributionModel, channel, repUserId, sequenceId])

  useEffect(() => {
    void load()
  }, [load])

  const handleLifecycle = useCallback((id: string, state: "reviewed" | "dismissed") => {
    setLifecycle(setAttributionRecLifecycle(id, state))
  }, [])

  const visible = useCallback(
    (list: GrowthAttributionRecommendation[]) =>
      list.filter((r) => (lifecycle[r.id]?.state ?? "active") !== "dismissed"),
    [lifecycle],
  )

  const wins = useMemo(() => visible(payload?.highConfidenceWins ?? []), [payload, visible])
  const under = useMemo(() => visible(payload?.underperformers ?? []), [payload, visible])
  const funnel = useMemo(() => visible(payload?.funnelBottlenecks ?? []), [payload, visible])
  const tests = useMemo(() => visible(payload?.suggestedTests ?? []), [payload, visible])

  return (
    <div className="space-y-4">
      <GrowthEngineCard title="Closed-loop recommendations (read-only)">
        <p className="text-xs text-muted-foreground mb-3">
          {GROWTH_REVENUE_ATTRIBUTION_RECOMMENDATIONS_QA_MARKER} · {GROWTH_ATTRIBUTION_RECOMMENDATION_SAFETY_NOTES}
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading recommendations…
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!loading && !error && payload ? (
          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-medium mb-2">High confidence wins</h3>
              {wins.length === 0 ? (
                <p className="text-sm text-muted-foreground">No high-confidence wins in this window yet.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {wins.slice(0, 6).map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      rec={rec}
                      lifecycle={lifecycle}
                      onLifecycle={handleLifecycle}
                      onViewDetails={setDetailRec}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-medium mb-2">Underperformers</h3>
              {under.length === 0 ? (
                <p className="text-sm text-muted-foreground">No underperformer signals detected.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {under.slice(0, 6).map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      rec={rec}
                      lifecycle={lifecycle}
                      onLifecycle={handleLifecycle}
                      onViewDetails={setDetailRec}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-medium mb-2">Funnel bottlenecks</h3>
              {funnel.length === 0 ? (
                <p className="text-sm text-muted-foreground">No funnel bottlenecks below threshold.</p>
              ) : (
                <div className="grid gap-3">
                  {funnel.map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      rec={rec}
                      lifecycle={lifecycle}
                      onLifecycle={handleLifecycle}
                      onViewDetails={setDetailRec}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-medium mb-2">Suggested next tests</h3>
              {tests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No suggested tests for current filters.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {tests.map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      rec={rec}
                      lifecycle={lifecycle}
                      onLifecycle={handleLifecycle}
                      onViewDetails={setDetailRec}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-medium mb-2">Closed-loop rollups (read-only feeds)</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Exported for future personalization, sequence, channel, sender, and industry systems — not wired to
                automation.
              </p>
              <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-x-auto max-h-48">
                {JSON.stringify(payload.rollups, null, 2)}
              </pre>
            </section>
          </div>
        ) : null}
      </GrowthEngineCard>

      {detailRec ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="bg-background rounded-lg border shadow-lg max-w-lg w-full p-4 space-y-3 max-h-[80vh] overflow-y-auto">
            <h3 className="font-medium">{detailRec.title}</h3>
            <p className="text-sm text-muted-foreground">{detailRec.explanation}</p>
            <p className="text-sm">
              <span className="font-medium">Recommended action:</span> {detailRec.recommendedAction}
            </p>
            <ul className="text-sm space-y-1">
              {detailRec.evidence.map((e) => (
                <li key={`${e.label}-${e.value}`}>
                  {e.label}: {e.value}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{detailRec.safetyNotes}</p>
            <Button size="sm" onClick={() => setDetailRec(null)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
