"use client"

import { Link2 } from "lucide-react"
import type { ProspectSearchIntelligenceCoverage } from "@/lib/growth/prospect-search/prospect-search-coverage-types"
import { GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-coverage-types"
import {
  GROWTH_PROSPECT_SEARCH_COVERAGE_UX_QA_MARKER,
  PROSPECT_SEARCH_COVERAGE_METRICS_TITLE,
} from "@/lib/growth/prospect-search/prospect-search-coverage-ux"

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-violet-950">{value}</span>
    </div>
  )
}

export function ProspectSearchCoverageMetricsCard({
  coverage,
  className,
}: {
  coverage: ProspectSearchIntelligenceCoverage | null | undefined
  className?: string
}) {
  if (!coverage) return null

  const { metrics } = coverage

  return (
    <section
      className={className}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER}
      data-coverage-ux-marker={GROWTH_PROSPECT_SEARCH_COVERAGE_UX_QA_MARKER}
      data-engine-coverage-metrics="v1"
    >
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-violet-800" />
        <h4 className="text-sm font-semibold text-violet-950">{PROSPECT_SEARCH_COVERAGE_METRICS_TITLE}</h4>
      </div>
      <div className="mt-2 space-y-1 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
        <MetricRow
          label="Canonical company"
          value={metrics.canonical_company_linked ? "Linked" : "Unresolved"}
        />
        <MetricRow
          label="Person linkage"
          value={`${metrics.contacts_with_canonical_person}/${metrics.contact_count} (${metrics.canonical_person_coverage_pct}%)`}
        />
        <MetricRow
          label="Verified channels"
          value={`${metrics.verified_email_person_count} email · ${metrics.verified_phone_person_count} phone · ${metrics.verified_profile_person_count} social`}
        />
        <MetricRow
          label="Buying committee"
          value={`${metrics.committee_verified_member_count} verified · ${Math.round(metrics.committee_coverage_score * 100)}% coverage`}
        />
        <MetricRow
          label="Company intelligence"
          value={
            metrics.has_verified_company_intelligence
              ? `${metrics.company_intelligence_category_count} categories (${metrics.intelligence_coverage_pct}%)`
              : "Not verified"
          }
        />
      </div>
    </section>
  )
}
