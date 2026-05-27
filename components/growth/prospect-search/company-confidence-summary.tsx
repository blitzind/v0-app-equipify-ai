"use client"

import { GrowthBadge, StatTile } from "@/components/growth/growth-ui-utils"
import {
  COMMITTEE_ROLE_LABELS,
  type GrowthProspectSearchCommitteeCompletion,
} from "@/lib/growth/market-intelligence/integrations/prospect-search-market-overlay"
import type { GrowthCompanyConfidenceScore } from "@/lib/growth/confidence-intelligence/confidence-intelligence-types"
import { GROWTH_CONFIDENCE_INTELLIGENCE_QA_MARKER } from "@/lib/growth/confidence-intelligence/confidence-intelligence-types"

function confidenceTone(score: number): "healthy" | "medium" | "neutral" {
  if (score >= 85) return "healthy"
  if (score >= 65) return "medium"
  return "neutral"
}

export function CompanyConfidenceSummary({
  confidence,
  committee,
}: {
  confidence: GrowthCompanyConfidenceScore | null | undefined
  committee: GrowthProspectSearchCommitteeCompletion | null | undefined
}) {
  if (!confidence && !committee) return null

  return (
    <section className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-900">
        Confidence Intelligence · {GROWTH_CONFIDENCE_INTELLIGENCE_QA_MARKER}
      </p>

      {confidence ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Overall" value={`${confidence.overall_confidence}%`} />
          <StatTile label="Discovery" value={`${confidence.discovery_confidence}%`} />
          <StatTile label="Contact" value={`${confidence.contact_confidence}%`} />
          <StatTile label="Signal" value={`${confidence.signal_confidence}%`} />
          <StatTile label="Coverage" value={`${confidence.coverage_confidence}%`} />
          <StatTile label="Freshness" value={`${confidence.freshness_confidence}%`} />
        </div>
      ) : null}

      {committee ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <GrowthBadge
            label={`Committee completion ${committee.completion_label}`}
            tone={confidenceTone(committee.completion_pct)}
          />
          {committee.missing_roles.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              Missing:{" "}
              {committee.missing_roles.map((role) => COMMITTEE_ROLE_LABELS[role]).join(", ")}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">All expected committee roles covered</span>
          )}
        </div>
      ) : null}

      {confidence?.evidence.length ? (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {confidence.evidence.slice(0, 4).map((entry) => (
            <li key={`${entry.dimension}-${entry.excerpt}`}>
              <span className="font-medium capitalize">{entry.dimension}</span>: {entry.excerpt}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
