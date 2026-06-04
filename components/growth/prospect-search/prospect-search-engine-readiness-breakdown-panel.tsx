"use client"

import type { GrowthProspectSearchReadinessDimensionScore } from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import type { GrowthProspectSearchEngineReadiness } from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import { GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import {
  GROWTH_PROSPECT_SEARCH_READINESS_UX_QA_MARKER,
  PROSPECT_SEARCH_READINESS_PANEL_TITLE,
} from "@/lib/growth/prospect-search/prospect-search-engine-readiness-ux"

function ReadinessDimensionBlock({
  title,
  dimension,
}: {
  title: string
  dimension: GrowthProspectSearchReadinessDimensionScore
}) {
  return (
    <div className="rounded-lg border border-violet-100 bg-white/80 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-violet-950">{title}</p>
        <p className="text-xs text-violet-800">
          {dimension.score}/100 — {dimension.summary}
        </p>
      </div>
      {dimension.evidence.length ? (
        <ul className="mt-2 list-inside list-disc text-[11px] text-emerald-900">
          {dimension.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {dimension.reasons.length ? (
        <ul className="mt-1 list-inside list-disc text-[11px] text-amber-900">
          {dimension.reasons.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function ProspectSearchEngineReadinessBreakdownPanel({
  readiness,
  companyName,
}: {
  readiness: GrowthProspectSearchEngineReadiness | null | undefined
  companyName?: string
}) {
  if (!readiness) return null

  return (
    <section
      className="mt-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4"
      data-qa-marker={GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER}
      data-readiness-ux-marker={GROWTH_PROSPECT_SEARCH_READINESS_UX_QA_MARKER}
      data-engine-readiness-breakdown="v1"
    >
      <h4 className="text-sm font-semibold text-violet-950">
        {PROSPECT_SEARCH_READINESS_PANEL_TITLE}
        {companyName ? ` — ${companyName}` : ""}
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">{readiness.operator_summary}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ReadinessDimensionBlock title="Contactability readiness" dimension={readiness.contactability} />
        <ReadinessDimensionBlock title="Channel readiness" dimension={readiness.channel} />
        <ReadinessDimensionBlock title="Committee readiness" dimension={readiness.committee} />
        <ReadinessDimensionBlock title="Company intelligence readiness" dimension={readiness.company_intelligence} />
      </div>

      {readiness.missing_critical_committee_roles.length ? (
        <p className="mt-3 text-[11px] text-amber-900">
          Missing critical committee roles: {readiness.missing_critical_committee_roles.join(", ")}
        </p>
      ) : null}
      {readiness.missing_intelligence_categories.length ? (
        <p className="mt-1 text-[11px] text-amber-900">
          Missing intelligence categories: {readiness.missing_intelligence_categories.slice(0, 6).join(", ")}
          {readiness.missing_intelligence_categories.length > 6 ? "…" : ""}
        </p>
      ) : null}
    </section>
  )
}
