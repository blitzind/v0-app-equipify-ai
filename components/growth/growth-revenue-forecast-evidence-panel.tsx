"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Radar } from "lucide-react"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import {
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
  type GrowthRevenueForecastEvidence,
} from "@/lib/growth/revenue-execution/revenue-execution-types"
import { revenueReadinessTierLabel } from "@/lib/growth/revenue-workflow/revenue-workflow-types"

export function GrowthRevenueForecastEvidencePanel({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true)
  const [evidence, setEvidence] = useState<GrowthRevenueForecastEvidence | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/platform/growth/revenue-execution/forecast-evidence?leadId=${encodeURIComponent(leadId)}`,
        { cache: "no-store" },
      )
      const payload = (await response.json()) as { evidence?: GrowthRevenueForecastEvidence }
      if (response.ok && payload.evidence?.qaMarker === GROWTH_REVENUE_EXECUTION_QA_MARKER) {
        setEvidence(payload.evidence)
      }
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  const collapsedSummary = evidence
    ? [evidence.forecastScore, evidence.revenueReadinessScore].filter((v) => v != null).join(" · ")
    : "Evidence layer"

  return (
    <GrowthCollapsibleEngineCard
      title="Forecast Evidence"
      icon={<Radar className="size-4" />}
      headerAside={collapsedSummary || "Read-only"}
      persistKey={GROWTH_DRAWER_CARD_KEYS.revenueForecastEvidence}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading forecast evidence…
        </div>
      ) : !evidence ? (
        <p className="text-sm text-muted-foreground">Forecast evidence unavailable.</p>
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">{evidence.summary}</p>
          <p className="text-xs text-muted-foreground">
            Forecast scoring unchanged — this panel exposes supporting evidence only.
          </p>

          <div className="flex flex-wrap gap-2">
            {evidence.forecastScore != null ? (
              <GrowthBadge label={`Forecast ${evidence.forecastScore}`} tone="healthy" />
            ) : null}
            {evidence.revenueReadinessScore != null && evidence.revenueReadinessTier ? (
              <GrowthBadge
                label={`Readiness ${evidence.revenueReadinessScore} · ${revenueReadinessTierLabel(evidence.revenueReadinessTier as never)}`}
                tone="attention"
              />
            ) : null}
            {evidence.opportunityRecommendationScore != null ? (
              <GrowthBadge label={`Opp rec ${evidence.opportunityRecommendationScore}`} tone="neutral" />
            ) : null}
            {evidence.opportunityConfidence != null ? (
              <GrowthBadge label={`Confidence ${evidence.opportunityConfidence}`} tone="neutral" />
            ) : null}
          </div>

          <EvidenceBlock title="Buying signals" items={evidence.buyingSignals} />
          <EvidenceBlock title="Commitments" items={evidence.commitments} />
          <EvidenceBlock title="Objections" items={evidence.objections} />

          <div className="flex flex-wrap gap-3 text-muted-foreground">
            {evidence.memoryCoverageScore != null ? (
              <span>Memory coverage {evidence.memoryCoverageScore}</span>
            ) : null}
            {evidence.relationshipStage ? (
              <span>Stage {evidence.relationshipStage.replace(/_/g, " ")}</span>
            ) : null}
            {evidence.engagementTrend ? (
              <span>Engagement {evidence.engagementTrend.replace(/_/g, " ")}</span>
            ) : null}
          </div>

          <Link
            href="/admin/growth/revenue-execution"
            className="text-xs font-medium text-primary hover:underline"
          >
            Open Revenue Command Center →
          </Link>
        </div>
      )}
    </GrowthCollapsibleEngineCard>
  )
}

function EvidenceBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 space-y-1 text-muted-foreground">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
