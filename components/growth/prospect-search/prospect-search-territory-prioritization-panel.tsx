"use client"

import { MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ProspectSearchTerritoryOpportunityScore } from "@/lib/growth/prospect-search/prospect-search-territory-prioritization"
import { GROWTH_TERRITORY_PRIORITIZATION_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-territory-prioritization"

function tierVariant(tier: string): "default" | "outline" | "secondary" | "destructive" {
  if (tier === "high_opportunity" || tier === "strong_coverage") return "default"
  if (tier === "research_gaps") return "secondary"
  if (tier === "low_signal") return "destructive"
  return "outline"
}

export function ProspectSearchTerritoryPrioritizationPanel({
  territories,
  compact = false,
}: {
  territories: ProspectSearchTerritoryOpportunityScore[]
  compact?: boolean
}) {
  if (territories.length === 0) return null

  const top = territories.slice(0, compact ? 3 : 8)

  return (
    <section
      className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4"
      data-territory-prioritization-marker={GROWTH_TERRITORY_PRIORITIZATION_QA_MARKER}
    >
      <div className="flex items-center gap-2">
        <MapPin className="size-4 text-emerald-800" />
        <h4 className="text-sm font-semibold text-emerald-950">Territory opportunity ranking</h4>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Operational intelligence from outreach-ready accounts, persona coverage, and contact quality
        — not fake geo precision.
      </p>

      <ul className="mt-3 space-y-2">
        {top.map((territory) => (
          <li
            key={`${territory.territory.label}-${territory.territory_score}`}
            className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-emerald-950">{territory.territory.label}</span>
              <Badge variant={tierVariant(territory.priority_tier)}>
                {territory.priority_tier.replace(/_/g, " ")}
              </Badge>
              <Badge variant="outline">{territory.territory_score}/100</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{territory.recommended_next_action}</p>
            {!compact ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {territory.metrics.company_density} companies · {territory.metrics.outreach_ready_account_count}{" "}
                outreach-ready · {territory.metrics.sequence_ready_account_count} sequence-ready ·{" "}
                {territory.metrics.emerging_opportunity_count} emerging · call-ready{" "}
                {territory.metrics.call_ready_coverage_pct}% · strengthening{" "}
                {territory.metrics.relationship_strengthening_pct}%
              </p>
            ) : null}
            {territory.risks.length > 0 ? (
              <p className="mt-1 text-[10px] text-amber-900">Risk: {territory.risks[0]}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
