"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { FlaskConical, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_SEQUENCE_AB_TESTING_PRIVACY_NOTE,
  GROWTH_SEQUENCE_AB_TESTING_QA_MARKER,
  GROWTH_SEQUENCE_EXPERIMENT_METRICS,
  type GrowthSequenceExperiment,
  type GrowthSequenceExperimentDashboard,
  type GrowthSequenceExperimentEvent,
  type GrowthSequenceExperimentWinnerRecommendation,
  experimentStatusLabel,
  experimentTypeLabel,
  maskExperimentLabel,
} from "@/lib/growth/experiments/experiment-types"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "blocked" | "neutral" | "medium"> = {
  draft: "neutral",
  active: "healthy",
  paused: "attention",
  completed: "medium",
  archived: "neutral",
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

function formatLift(value: number | null | undefined): string {
  if (value == null) return "—"
  return `${(value / 100).toFixed(1)}%`
}

function formatConfidence(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthSequenceExperimentDashboard
  message?: string
}

export function GrowthSequenceExperimentsDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthSequenceExperimentDashboard | null>(null)
  const [actionExperimentId, setActionExperimentId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/experiments/dashboard", { cache: "no-store" })
      const payload = (await response.json()) as DashboardPayload
      if (!response.ok || !payload.ok || !payload.dashboard) {
        throw new Error(payload.message ?? "Could not load experiments dashboard.")
      }
      setDashboard(payload.dashboard)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load experiments dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function experimentAction(experimentId: string, action: "start" | "pause" | "complete" | "promote-winner", variantId?: string) {
    setActionExperimentId(experimentId)
    setError(null)
    try {
      const body =
        action === "promote-winner" && variantId
          ? JSON.stringify({ variantId })
          : undefined
      const response = await fetch(`/api/platform/growth/experiments/${experimentId}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      })
      const payload = (await response.json()) as { ok?: boolean; message?: string }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? `Could not ${action.replace("-", " ")} experiment.`)
      }
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Experiment action failed.")
    } finally {
      setActionExperimentId(null)
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading experiments dashboard…
      </div>
    )
  }

  const experiments = dashboard?.experiments ?? []
  const events = dashboard?.events ?? []
  const results = dashboard?.results ?? []
  const variants = experiments.flatMap((experiment) =>
    (experiment.variants ?? []).map((variant) => ({
      ...variant,
      experimentName: experiment.name,
      experimentStatus: experiment.status,
    })),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <GrowthBadge label={GROWTH_SEQUENCE_AB_TESTING_QA_MARKER} tone="neutral" />
          <p className="text-xs text-muted-foreground">{GROWTH_SEQUENCE_AB_TESTING_PRIVACY_NOTE}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/sequences/execution">Sequence Execution</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <GrowthEngineCard title="Experiment Intelligence" icon={<FlaskConical className="size-4" />}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Active Experiments" value={String(dashboard?.activeExperiments ?? 0)} />
          <StatTile label="Winner Recommendations" value={String(dashboard?.winnerRecommendations.length ?? 0)} />
          <StatTile label="Risky Variants" value={String(dashboard?.riskyVariants.length ?? 0)} />
          <StatTile label="Lift Observed" value={String(dashboard?.liftObserved.length ?? 0)} />
        </div>
      </GrowthEngineCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthEngineCard title="Winner Recommendations">
          {(dashboard?.winnerRecommendations ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No winner recommendations yet.</p>
          ) : (
            <div className="space-y-2">
              {(dashboard?.winnerRecommendations ?? []).map((entry) => (
                <RecommendationRow
                  key={entry.experimentId}
                  recommendation={entry}
                  experiment={experiments.find((experiment) => experiment.id === entry.experimentId)}
                  busy={actionExperimentId === entry.experimentId}
                  onPromote={() =>
                    entry.recommendedVariantId
                      ? void experimentAction(entry.experimentId, "promote-winner", entry.recommendedVariantId)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Risky Variants">
          {(dashboard?.riskyVariants ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No risky variants flagged.</p>
          ) : (
            <div className="space-y-2">
              {(dashboard?.riskyVariants ?? []).map((entry) => (
                <div
                  key={`${entry.experimentId}-${entry.variantId}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{entry.variantLabel}</p>
                    <p className="text-muted-foreground">{entry.experimentName}</p>
                  </div>
                  <GrowthBadge label={`Risk ${entry.riskScore}`} tone="critical" />
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Lift Observed">
        {(dashboard?.liftObserved ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No lift observed yet.</p>
        ) : (
          <div className="space-y-2">
            {(dashboard?.liftObserved ?? []).map((entry) => (
              <div
                key={`${entry.experimentId}-${entry.variantLabel}`}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{entry.experimentName}</p>
                  <p className="text-muted-foreground">{entry.variantLabel}</p>
                </div>
                <GrowthBadge label={formatLift(entry.liftBasisPoints)} tone="healthy" />
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>

      <GrowthEngineCard title="Experiments">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Min sample</th>
                <th className="px-2 py-2 font-medium">Confidence</th>
                <th className="px-2 py-2 font-medium">Started</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {experiments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-muted-foreground">
                    No experiments yet.
                  </td>
                </tr>
              ) : (
                experiments.map((experiment) => (
                  <tr key={experiment.id} className="border-b border-border/70 align-top">
                    <td className="px-2 py-3 font-medium">{maskExperimentLabel(experiment.id, experiment.name)}</td>
                    <td className="px-2 py-3 text-muted-foreground">{experimentTypeLabel(experiment.experimentType)}</td>
                    <td className="px-2 py-3">
                      <GrowthBadge
                        label={experimentStatusLabel(experiment.status)}
                        tone={STATUS_TONE[experiment.status] ?? "neutral"}
                      />
                    </td>
                    <td className="px-2 py-3 tabular-nums">{experiment.minimumSampleSize}</td>
                    <td className="px-2 py-3 tabular-nums">{formatConfidence(experiment.confidenceThreshold)}</td>
                    <td className="px-2 py-3 text-muted-foreground">{formatDate(experiment.startedAt)}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        {experiment.status === "draft" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionExperimentId === experiment.id}
                            onClick={() => void experimentAction(experiment.id, "start")}
                          >
                            Start
                          </Button>
                        ) : null}
                        {experiment.status === "active" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionExperimentId === experiment.id}
                            onClick={() => void experimentAction(experiment.id, "pause")}
                          >
                            Pause
                          </Button>
                        ) : null}
                        {["active", "paused"].includes(experiment.status) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionExperimentId === experiment.id}
                            onClick={() => void experimentAction(experiment.id, "complete")}
                          >
                            Complete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthEngineCard title="Variants">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Experiment</th>
                  <th className="px-2 py-2 font-medium">Label</th>
                  <th className="px-2 py-2 font-medium">Control</th>
                  <th className="px-2 py-2 font-medium">Weight</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {variants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-muted-foreground">
                      No variants yet.
                    </td>
                  </tr>
                ) : (
                  variants.map((variant) => (
                    <tr key={variant.id} className="border-b border-border/70">
                      <td className="px-2 py-3">{variant.experimentName}</td>
                      <td className="px-2 py-3 font-medium">{variant.label}</td>
                      <td className="px-2 py-3">{variant.isControl ? "Yes" : "No"}</td>
                      <td className="px-2 py-3 tabular-nums">{variant.weight}</td>
                      <td className="px-2 py-3">
                        <GrowthBadge label={variant.status} tone={variant.status === "active" ? "healthy" : "neutral"} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Results">
          <p className="mb-3 text-xs text-muted-foreground">
            Per-variant metrics aggregate from delivery attempts and engagement attribution.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Variant</th>
                  {GROWTH_SEQUENCE_EXPERIMENT_METRICS.map((metric) => (
                    <th key={metric} className="px-2 py-2 font-medium">
                      {metric.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={GROWTH_SEQUENCE_EXPERIMENT_METRICS.length + 1} className="px-2 py-4 text-muted-foreground">
                      No results yet — metrics populate after sends and engagement events.
                    </td>
                  </tr>
                ) : (
                  results.map((row) => (
                    <tr key={row.variantId} className="border-b border-border/70">
                      <td className="px-2 py-3 font-medium">
                        {row.variantLabel}
                        <span className="block text-xs text-muted-foreground">{row.experimentName}</span>
                      </td>
                      {GROWTH_SEQUENCE_EXPERIMENT_METRICS.map((metric) => (
                        <td key={metric} className="px-2 py-3 tabular-nums">
                          {row.metrics[metric] ?? 0}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Events">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">When</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Title</th>
                <th className="px-2 py-2 font-medium">Severity</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-muted-foreground">
                    No experiment events yet.
                  </td>
                </tr>
              ) : (
                events.map((event) => <EventRow key={event.id} event={event} />)
              )}
            </tbody>
          </table>
        </div>
      </GrowthEngineCard>
    </div>
  )
}

function RecommendationRow({
  recommendation,
  experiment,
  busy,
  onPromote,
}: {
  recommendation: GrowthSequenceExperimentWinnerRecommendation
  experiment?: GrowthSequenceExperiment
  busy: boolean
  onPromote: () => void
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {experiment ? maskExperimentLabel(experiment.id, experiment.name) : recommendation.experimentId.slice(0, 8)}
          </p>
          <p className="text-muted-foreground">
            {recommendation.recommendedVariantLabel ?? "Variant"} · lift {formatLift(recommendation.liftBasisPoints)} ·
            confidence {formatConfidence(recommendation.confidence)}
          </p>
        </div>
        <Button size="sm" disabled={busy || !recommendation.recommendedVariantId} onClick={onPromote}>
          Promote winner
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Human promotion required — no autonomous rollout.
      </p>
    </div>
  )
}

function EventRow({ event }: { event: GrowthSequenceExperimentEvent }) {
  const tone =
    event.severity === "critical" || event.severity === "high"
      ? "critical"
      : event.severity === "medium"
        ? "attention"
        : "neutral"

  return (
    <tr className="border-b border-border/70">
      <td className="px-2 py-3 text-muted-foreground">{formatDate(event.createdAt)}</td>
      <td className="px-2 py-3">{event.eventType.replace(/_/g, " ")}</td>
      <td className="px-2 py-3">{event.title}</td>
      <td className="px-2 py-3">
        <GrowthBadge label={event.severity} tone={tone} />
      </td>
    </tr>
  )
}
