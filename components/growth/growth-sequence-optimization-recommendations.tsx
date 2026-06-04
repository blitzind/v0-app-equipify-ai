"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Copy, Eye, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  readSequenceOptimizationRecLifecycle,
  setSequenceOptimizationRecLifecycle,
  type GrowthSequenceOptimizationRecLifecycleMap,
} from "@/lib/growth/sequence-optimization/sequence-optimization-lifecycle"
import {
  GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
  GROWTH_SEQUENCE_OPTIMIZATION_V2_QA_MARKER,
  sequenceOptimizationTypeLabel,
  type GrowthSequenceOptimizationRecommendation,
  type GrowthSequenceOptimizationRecommendationsPayload,
} from "@/lib/growth/sequence-optimization/sequence-optimization-types"

type Props = {
  sequenceId?: string
  attributionModel?: string
}

function RecommendationCard({
  rec,
  lifecycle,
  onLifecycle,
  onViewDetails,
}: {
  rec: GrowthSequenceOptimizationRecommendation
  lifecycle: GrowthSequenceOptimizationRecLifecycleMap
  onLifecycle: (id: string, state: "reviewed" | "dismissed") => void
  onViewDetails: (rec: GrowthSequenceOptimizationRecommendation) => void
}) {
  const state = lifecycle[rec.id]?.state ?? "active"
  if (state === "dismissed") return null

  const [copied, setCopied] = useState(false)

  async function copyRec(): Promise<void> {
    const text = [
      rec.title,
      rec.explanation,
      `Expected impact: ${rec.expectedImpact}`,
      `Recommended edit: ${rec.recommendedEdit}`,
      `Confidence: ${rec.confidence}%`,
      rec.sequenceLabel ? `Sequence: ${rec.sequenceLabel}` : null,
      rec.sequenceStepLabel ? `Step: ${rec.sequenceStepLabel}` : null,
      ...rec.evidence.map((e) => `${e.label}: ${e.value}`),
      rec.safetyNotes,
    ]
      .filter(Boolean)
      .join("\n")
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
            {sequenceOptimizationTypeLabel(rec.recommendationType)} · {rec.sequenceLabel}
            {rec.sequenceStepLabel ? ` · ${rec.sequenceStepLabel}` : ""} · {rec.confidence}% confidence
          </p>
        </div>
        {state === "reviewed" ? <GrowthBadge label="Reviewed" tone="neutral" /> : null}
      </div>
      <p className="text-sm text-muted-foreground">{rec.explanation}</p>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Expected impact:</span> {rec.expectedImpact}
      </p>
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

export function GrowthSequenceOptimizationRecommendationsSection({ sequenceId, attributionModel }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<GrowthSequenceOptimizationRecommendationsPayload | null>(null)
  const [lifecycle, setLifecycle] = useState<GrowthSequenceOptimizationRecLifecycleMap>({})
  const [detailRec, setDetailRec] = useState<GrowthSequenceOptimizationRecommendation | null>(null)

  useEffect(() => {
    setLifecycle(readSequenceOptimizationRecLifecycle())
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (sequenceId?.trim()) params.set("sequence_id", sequenceId.trim())
      if (attributionModel?.trim()) params.set("attribution_model", attributionModel.trim())

      const response = await fetch(
        `/api/platform/growth/sequences/optimization/recommendations?${params}`,
        { cache: "no-store" },
      )
      const body = (await response.json()) as {
        ok?: boolean
        recommendations?: GrowthSequenceOptimizationRecommendationsPayload
        message?: string
      }
      if (!response.ok || !body.ok || !body.recommendations) {
        throw new Error(body.message ?? "Could not load sequence optimization recommendations.")
      }
      setPayload(body.recommendations)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load recommendations.")
    } finally {
      setLoading(false)
    }
  }, [sequenceId, attributionModel])

  useEffect(() => {
    void load()
  }, [load])

  const handleLifecycle = useCallback((id: string, state: "reviewed" | "dismissed") => {
    setLifecycle(setSequenceOptimizationRecLifecycle(id, state))
  }, [])

  const visible = useCallback(
    (list: GrowthSequenceOptimizationRecommendation[]) =>
      list.filter((r) => (lifecycle[r.id]?.state ?? "active") !== "dismissed"),
    [lifecycle],
  )

  const winning = useMemo(() => visible(payload?.winningAngles ?? []), [payload, visible])
  const copy = useMemo(() => visible(payload?.copyImprovements ?? []), [payload, visible])
  const structure = useMemo(() => visible(payload?.stepStructure ?? []), [payload, visible])
  const timing = useMemo(() => visible(payload?.channelTiming ?? []), [payload, visible])
  const under = useMemo(() => visible(payload?.underperformers ?? []), [payload, visible])

  return (
    <div className="space-y-4">
      <GrowthEngineCard title="Sequence optimization (approval-only)">
        <p className="text-xs text-muted-foreground mb-3">
          {GROWTH_SEQUENCE_OPTIMIZATION_V2_QA_MARKER}
          {payload ? ` · ${payload.touchesAnalyzed} touches analyzed` : ""} · {GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES}
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
              <h3 className="text-sm font-medium mb-2">Winning angles</h3>
              {winning.length === 0 ? (
                <p className="text-sm text-muted-foreground">No winning-angle signals in this window.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {winning.slice(0, 6).map((rec) => (
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
              <h3 className="text-sm font-medium mb-2">Copy improvements</h3>
              {copy.length === 0 ? (
                <p className="text-sm text-muted-foreground">No copy improvement signals.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {copy.slice(0, 6).map((rec) => (
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
              <h3 className="text-sm font-medium mb-2">Step structure</h3>
              {structure.length === 0 ? (
                <p className="text-sm text-muted-foreground">No step structure changes suggested.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {structure.slice(0, 6).map((rec) => (
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
              <h3 className="text-sm font-medium mb-2">Channel & timing</h3>
              {timing.length === 0 ? (
                <p className="text-sm text-muted-foreground">No channel or timing adjustments suggested.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {timing.slice(0, 6).map((rec) => (
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
                <p className="text-sm text-muted-foreground">No underperforming steps flagged.</p>
              ) : (
                <div className="grid gap-3">
                  {under.map((rec) => (
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
          </div>
        ) : null}
      </GrowthEngineCard>

      {detailRec ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="bg-background rounded-lg border shadow-lg max-w-lg w-full p-4 space-y-3 max-h-[80vh] overflow-y-auto">
            <h3 className="font-medium">{detailRec.title}</h3>
            <p className="text-sm text-muted-foreground">{detailRec.explanation}</p>
            <p className="text-sm">
              <span className="font-medium">Expected impact:</span> {detailRec.expectedImpact}
            </p>
            <p className="text-sm">
              <span className="font-medium">Recommended edit:</span> {detailRec.recommendedEdit}
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
