"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, Loader2, RefreshCw, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  APOLLO_OPERATOR_SCALE_QA_MARKER,
  type ApolloOperatorScaleReport,
} from "@/lib/growth/apollo/apollo-operator-scale-types"
import { cn } from "@/lib/utils"

type ScaleTab = "throughput" | "quality" | "bottlenecks" | "regeneration" | "simulation" | "forecast"

export function ApolloOperatorScalePanel({ className }: { className?: string }) {
  const [report, setReport] = useState<ApolloOperatorScaleReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<ScaleTab>("throughput")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/apollo-operator-scale/report", { cache: "no-store" })
      const json = (await res.json()) as { ok?: boolean; report?: ApolloOperatorScaleReport; message?: string }
      if (!res.ok || !json.ok || !json.report) throw new Error(json.message ?? "Could not load operator scale report.")
      setReport(json.report)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const tabs: { id: ScaleTab; label: string }[] = [
    { id: "throughput", label: "Throughput" },
    { id: "quality", label: "Approval quality" },
    { id: "bottlenecks", label: "Bottlenecks" },
    { id: "regeneration", label: "Regeneration" },
    { id: "simulation", label: "Simulation" },
    { id: "forecast", label: "Scale forecast" },
  ]

  return (
    <GrowthEngineCard
      title="Apollo Operator Scale & Bottleneck Dashboard"
      icon={<Activity size={16} />}
      className={cn("mb-6", className)}
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Measures approval throughput and simulates low-touch paths — simulation only, no auto-approval.{" "}
        {APOLLO_OPERATOR_SCALE_QA_MARKER}
      </p>

      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
        {report?.readiness && (
          <GrowthBadge
            label={`Readiness ${report.readiness.score} — ${report.readiness.level.replace(/_/g, " ")}`}
            tone={report.readiness.score >= 60 ? "healthy" : "attention"}
          />
        )}
      </div>

      {report?.verdict && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Capacity (items/day)" value={report.verdict.current_operator_capacity_items_per_day} icon={<TrendingUp size={14} />} />
          <StatTile label="Load at 25 cos" value={report.verdict.capacity_at_25_companies} />
          <StatTile label="Load at 50 cos" value={report.verdict.capacity_at_50_companies} />
          <StatTile label="Load at 100 cos" value={report.verdict.capacity_at_100_companies} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((entry) => (
          <Button
            key={entry.id}
            size="sm"
            variant={tab === entry.id ? "default" : "outline"}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {tab === "throughput" && report?.throughput && (
        <div className="space-y-2">
          {report.throughput.map((row) => (
            <div key={row.stage} className="rounded border px-3 py-2 text-sm">
              <strong>{row.label}</strong> — created {row.items_created_per_day}/day, approved {row.items_approved_per_day}/day,
              pending {row.pending_count}, max age {row.max_queue_age_hours ?? "—"}h
            </div>
          ))}
        </div>
      )}

      {tab === "quality" && report && (
        <div className="space-y-2">
          {report.approval_quality.map((row) => (
            <div key={row.stage} className="rounded border px-3 py-2 text-sm">
              <strong>{row.label}</strong> — approve {row.approve_pct}%, reject {row.reject_pct}%, regenerate {row.regenerate_pct}%
              <span className="text-muted-foreground"> · accuracy {report.confidence_calibration.find((c) => c.stage === row.stage)?.automation_accuracy_score ?? "—"}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "bottlenecks" && report?.bottlenecks && (
        <div className="space-y-2">
          {report.bottlenecks.hotspots.map((hotspot) => (
            <div key={hotspot.stage} className="rounded border px-3 py-2 text-sm">
              <strong>{hotspot.stage}</strong> — {hotspot.pending_count} pending, max age {hotspot.max_age_hours}h
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Oldest items: {report.bottlenecks.oldest_items.length}</p>
        </div>
      )}

      {tab === "regeneration" && report?.regeneration && (
        <div className="space-y-2">
          {report.regeneration.map((row) => (
            <div key={row.category} className="rounded border px-3 py-2 text-sm">
              {row.label}: {row.count} ({row.pct}%)
            </div>
          ))}
        </div>
      )}

      {tab === "simulation" && report?.simulations && (
        <div className="space-y-2">
          {report.simulations.map((sim) => (
            <div key={sim.threshold} className="rounded border px-3 py-2 text-sm">
              Threshold {sim.threshold}+ — avoid {sim.approvals_avoided} approvals, save {sim.operator_hours_saved}h,
              est. error {sim.estimated_error_rate_pct}% (simulation only)
            </div>
          ))}
        </div>
      )}

      {tab === "forecast" && report?.forecasts && (
        <div className="space-y-2">
          {report.forecasts.map((row) => (
            <div key={row.target_companies} className="rounded border px-3 py-2 text-sm">
              {row.target_companies} companies — {row.estimated_daily_queue_items} items/day,
              {row.estimated_operator_hours_per_day} operator hours/day
            </div>
          ))}
        </div>
      )}

      {report?.recommendations && report.recommendations.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {report.recommendations.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}
