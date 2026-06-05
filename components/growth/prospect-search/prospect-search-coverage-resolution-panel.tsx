"use client"

import type { ProspectSearchIntelligenceCoverage } from "@/lib/growth/prospect-search/prospect-search-coverage-types"
import { GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-coverage-types"
import {
  GROWTH_PROSPECT_SEARCH_COVERAGE_UX_QA_MARKER,
  PROSPECT_SEARCH_COMPANY_RESOLUTION_METHOD_LABELS,
  PROSPECT_SEARCH_COVERAGE_PANEL_TITLE,
  PROSPECT_SEARCH_PERSON_LINKAGE_METHOD_LABELS,
} from "@/lib/growth/prospect-search/prospect-search-coverage-ux"
import { ProspectSearchCoverageMetricsCard } from "@/components/growth/prospect-search/prospect-search-coverage-metrics-card"

export function ProspectSearchCoverageResolutionPanel({
  coverage,
  companyName,
}: {
  coverage: ProspectSearchIntelligenceCoverage | null | undefined
  companyName?: string
}) {
  if (!coverage) return null

  const { company, contacts } = coverage

  return (
    <section
      className="mt-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4"
      data-qa-marker={GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER}
      data-coverage-ux-marker={GROWTH_PROSPECT_SEARCH_COVERAGE_UX_QA_MARKER}
      data-engine-coverage-resolution="v1"
    >
      <h4 className="text-sm font-semibold text-violet-950">
        {PROSPECT_SEARCH_COVERAGE_PANEL_TITLE}
        {companyName ? ` — ${companyName}` : ""}
      </h4>

      <ProspectSearchCoverageMetricsCard coverage={coverage} className="mt-3" />

      <div className="mt-3 rounded-lg border border-violet-100 bg-white/80 p-3 text-xs">
        <p className="font-semibold text-violet-950">Company resolution</p>
        <p className="mt-1 text-violet-900">
          {PROSPECT_SEARCH_COMPANY_RESOLUTION_METHOD_LABELS[company.method]} · confidence{" "}
          {Math.round(company.confidence * 100)}%
          {company.normalized_domain ? ` · ${company.normalized_domain}` : ""}
        </p>
        {company.evidence.length ? (
          <ul className="mt-2 list-inside list-disc text-[11px] text-emerald-900">
            {company.evidence.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {company.reasons.length ? (
          <ul className="mt-1 list-inside list-disc text-[11px] text-amber-900">
            {company.reasons.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {contacts.length ? (
        <ul className="mt-3 space-y-2 text-xs">
          {contacts.slice(0, 8).map((contact) => (
            <li
              key={contact.contact_id}
              className="rounded-lg border border-violet-100 bg-white/80 px-3 py-2"
            >
              <p className="font-medium text-violet-950">
                Contact {contact.contact_id.slice(0, 8)}… —{" "}
                {PROSPECT_SEARCH_PERSON_LINKAGE_METHOD_LABELS[contact.method]}
                {contact.linked ? ` (${Math.round(contact.confidence * 100)}%)` : ""}
              </p>
              {contact.evidence[0] ? (
                <p className="mt-0.5 text-[11px] text-emerald-900">{contact.evidence[0]}</p>
              ) : null}
              {contact.reasons[0] ? (
                <p className="mt-0.5 text-[11px] text-amber-900">{contact.reasons[0]}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
