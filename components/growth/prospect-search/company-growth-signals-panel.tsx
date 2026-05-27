"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthCompanyGrowthSignalsSnapshot } from "@/lib/growth/company-growth-signals/company-growth-signal-types"
import { GROWTH_SIGNAL_TYPE_LABELS } from "@/lib/growth/company-growth-signals/company-growth-signal-types"

function tierTone(tier: string): "attention" | "healthy" | "medium" | "neutral" {
  switch (tier) {
    case "urgent":
      return "attention"
    case "high":
      return "healthy"
    case "moderate":
      return "medium"
    default:
      return "neutral"
  }
}

export function CompanyGrowthSignalsPanel({
  companyId,
  companyName,
  website,
  contactCoverageLabel,
  lastVerifiedAt,
}: {
  companyId: string
  companyName: string
  website?: string | null
  contactCoverageLabel?: string | null
  lastVerifiedAt?: string | null
}) {
  const [snapshot, setSnapshot] = useState<GrowthCompanyGrowthSignalsSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(
    async (run = false) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ company_id: companyId, company_name: companyName })
        if (website) params.set("website", website)
        if (run) params.set("run", "1")
        const res = await fetch(`/api/platform/growth/company-growth-signals?${params.toString()}`, {
          cache: "no-store",
        })
        const json = (await res.json()) as { ok?: boolean; snapshot?: GrowthCompanyGrowthSignalsSnapshot }
        if (res.ok && json.ok && json.snapshot) setSnapshot(json.snapshot)
      } finally {
        setLoading(false)
      }
    },
    [companyId, companyName, website],
  )

  useEffect(() => {
    void load(false)
  }, [load])

  const topSignal = snapshot?.score?.top_signals[0] ?? null

  return (
    <section className="rounded-xl border border-sky-100 bg-sky-50/40 p-4" data-qa-marker="growth-company-growth-signals-v1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TrendingUp className="size-4 text-sky-700" />
          <h4 className="text-sm font-semibold text-sky-950">Growth signals — {companyName}</h4>
          {snapshot?.score ? (
            <GrowthBadge label={`${snapshot.score.growth_signal_score} · ${snapshot.score.signal_tier}`} tone={tierTone(snapshot.score.signal_tier)} />
          ) : null}
        </div>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load(true)}>
          {loading ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <RefreshCw className="mr-1 size-3.5" />}
          Refresh signals
        </Button>
      </div>

      {!snapshot?.schema_ready ? (
        <p className="mt-2 text-xs text-amber-800">
          Growth signal schema not applied — run migration 20270404120000_growth_engine_multi_source_growth_signals.sql.
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        {contactCoverageLabel ? <span>Contact coverage {contactCoverageLabel}</span> : null}
        {topSignal ? (
          <span>
            Top signal: {GROWTH_SIGNAL_TYPE_LABELS[topSignal.signal_type]} ({topSignal.confidence_score}%)
          </span>
        ) : null}
        {lastVerifiedAt ? <span>Last verified {new Date(lastVerifiedAt).toLocaleDateString()}</span> : null}
        {snapshot?.score?.last_computed_at ? (
          <span>Signals updated {new Date(snapshot.score.last_computed_at).toLocaleDateString()}</span>
        ) : null}
      </div>

      {snapshot?.score?.recommended_next_action ? (
        <p className="mt-2 rounded-md border border-sky-200 bg-white px-2.5 py-2 text-xs text-sky-950">
          Recommended: {snapshot.score.recommended_next_action}
        </p>
      ) : null}

      {snapshot?.signals.length ? (
        <ul className="mt-3 space-y-2">
          {snapshot.signals.slice(0, 6).map((signal) => (
            <li key={signal.id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-2 text-left"
                onClick={() => setExpandedId(expandedId === signal.id ? null : signal.id)}
              >
                <div>
                  <p className="font-medium">{GROWTH_SIGNAL_TYPE_LABELS[signal.signal_type]}</p>
                  <p className="text-muted-foreground">
                    {signal.source_type.replace(/_/g, " ")} · {Math.round(signal.confidence_score)}% confidence
                  </p>
                </div>
                <GrowthBadge label={`${Math.round(signal.confidence_score)}%`} tone="neutral" />
              </button>
              {expandedId === signal.id ? (
                <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                  {signal.source_url ? <p>Source: {signal.source_url}</p> : null}
                  <p>Detected: {new Date(signal.detected_at).toLocaleString()}</p>
                  {signal.expires_at ? <p>Expires: {new Date(signal.expires_at).toLocaleString()}</p> : null}
                  <p>Evidence: {signal.evidence_excerpt}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No active growth signals yet. Refresh to crawl careers, tech, and reputation evidence.</p>
      )}
    </section>
  )
}
