"use client"

import { Sparkles, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ProspectSearchOpportunityEmergence } from "@/lib/growth/prospect-search/prospect-search-opportunity-emergence"
import type { ProspectSearchSequenceReadiness } from "@/lib/growth/prospect-search/prospect-search-sequence-readiness"
import type { ProspectSearchOperatingAlertsSnapshot } from "@/lib/growth/prospect-search/prospect-search-revenue-operating-alerts"
import { GROWTH_OPPORTUNITY_EMERGENCE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-opportunity-emergence"
import { GROWTH_SEQUENCE_READINESS_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-sequence-readiness"
import { GROWTH_REVENUE_OPERATING_ALERTS_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-revenue-operating-alerts"

function urgencyVariant(level: string): "default" | "outline" | "secondary" | "destructive" {
  if (level === "high" || level === "critical") return "destructive"
  if (level === "moderate") return "secondary"
  return "outline"
}

export function ProspectSearchOperationalIntelligencePanel({
  opportunity,
  sequenceReadiness,
  operatingAlerts,
  compact = false,
}: {
  opportunity: ProspectSearchOpportunityEmergence | null | undefined
  sequenceReadiness: ProspectSearchSequenceReadiness | null | undefined
  operatingAlerts?: ProspectSearchOperatingAlertsSnapshot | null
  compact?: boolean
}) {
  if (!opportunity && !sequenceReadiness) return null

  return (
    <section
      className="rounded-xl border border-amber-100 bg-amber-50/40 p-4"
      data-opportunity-emergence-marker={GROWTH_OPPORTUNITY_EMERGENCE_QA_MARKER}
      data-sequence-readiness-marker={GROWTH_SEQUENCE_READINESS_QA_MARKER}
      data-revenue-operating-alerts-marker={GROWTH_REVENUE_OPERATING_ALERTS_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-amber-800" />
        <h4 className="text-sm font-semibold text-amber-950">Operational opportunity</h4>
      </div>

      {opportunity ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={urgencyVariant(opportunity.urgency_level)}>
              {opportunity.emergence_tier.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline">{opportunity.emergence_score}/100</Badge>
            <Badge variant="outline">{opportunity.opportunity_trend}</Badge>
          </div>
          <p className="mt-2 text-muted-foreground">{opportunity.recommended_next_action}</p>
          {!compact && opportunity.emergence_reasons.length > 0 ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted-foreground">
              {opportunity.emergence_reasons.slice(0, 3).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {sequenceReadiness ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{sequenceReadiness.readiness_state.replace(/_/g, " ")}</Badge>
            <Badge variant="secondary">
              {sequenceReadiness.sequence_suitability.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline">{sequenceReadiness.readiness_score}/100</Badge>
          </div>
          <p className="mt-2 font-medium">{sequenceReadiness.suggested_sequence_type}</p>
          {sequenceReadiness.blockers.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-amber-900">
              {sequenceReadiness.blockers.slice(0, 2).map((blocker) => (
                <li key={blocker}>Blocker: {blocker}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {operatingAlerts && operatingAlerts.alerts.length > 0 && !compact ? (
        <ul className="mt-3 space-y-2">
          {operatingAlerts.alerts.slice(0, 4).map((alert) => (
            <li
              key={alert.id}
              className="flex gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs"
            >
              <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-800" />
              <div>
                <p className="font-medium">{alert.title}</p>
                <p className="text-muted-foreground">{alert.detail}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{alert.suggested_action}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
