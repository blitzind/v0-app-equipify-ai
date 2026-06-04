"use client"

import { ClipboardCheck } from "lucide-react"
import type { GrowthProspectSearchEngineReadiness } from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import { GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import { ProspectSearchEngineReadinessBadges } from "@/components/growth/prospect-search/prospect-search-engine-readiness-badges"
import {
  GROWTH_PROSPECT_SEARCH_READINESS_UX_QA_MARKER,
  PROSPECT_SEARCH_READINESS_LEVEL_TONES,
  PROSPECT_SEARCH_READINESS_SUMMARY_TITLE,
} from "@/lib/growth/prospect-search/prospect-search-engine-readiness-ux"

function DimensionRow({
  label,
  dimension,
}: {
  label: string
  dimension: GrowthProspectSearchEngineReadiness["contactability"]
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={PROSPECT_SEARCH_READINESS_LEVEL_TONES[dimension.level]}>
        {dimension.score}/100 · {dimension.level}
      </span>
    </div>
  )
}

export function ProspectSearchEngineReadinessSummaryCard({
  readiness,
  className,
}: {
  readiness: GrowthProspectSearchEngineReadiness | null | undefined
  className?: string
}) {
  if (!readiness) return null

  return (
    <section
      className={className}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER}
      data-readiness-ux-marker={GROWTH_PROSPECT_SEARCH_READINESS_UX_QA_MARKER}
      data-engine-readiness-summary="v1"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardCheck className="size-4 text-violet-800" />
        <h4 className="text-sm font-semibold text-violet-950">{PROSPECT_SEARCH_READINESS_SUMMARY_TITLE}</h4>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{readiness.operator_summary}</p>
      <ProspectSearchEngineReadinessBadges readiness={readiness} className="mt-2" />
      <div className="mt-3 space-y-1 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
        <DimensionRow label="Contactability" dimension={readiness.contactability} />
        <DimensionRow label="Channels" dimension={readiness.channel} />
        <DimensionRow label="Buying committee" dimension={readiness.committee} />
        <DimensionRow label="Company intelligence" dimension={readiness.company_intelligence} />
        <DimensionRow label="Overall research" dimension={readiness.overall} />
      </div>
      {readiness.reachable_decision_maker_count > 0 ? (
        <p className="mt-2 text-[11px] text-violet-900">
          {readiness.reachable_decision_maker_count} reachable verified decision maker(s)
        </p>
      ) : null}
    </section>
  )
}
