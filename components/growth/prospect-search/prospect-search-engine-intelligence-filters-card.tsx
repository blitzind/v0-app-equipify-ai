"use client"

import type { Dispatch, SetStateAction } from "react"
import { cn } from "@/lib/utils"
import type { GrowthCompanyIntelligenceCategory } from "@/lib/growth/company-intelligence/company-intelligence-types"
import type { GrowthBuyingCommitteeIntelligenceRole } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  GROWTH_PROSPECT_SEARCH_INTELLIGENCE_UX_QA_MARKER,
  PROSPECT_SEARCH_BUYING_COMMITTEE_ROLE_LABELS,
  PROSPECT_SEARCH_COMPANY_INTELLIGENCE_CATEGORY_LABELS,
  PROSPECT_SEARCH_ENGINE_FILTER_SECTION_HELPER,
  PROSPECT_SEARCH_ENGINE_FILTER_SECTION_LABEL,
  PROSPECT_SEARCH_ENGINE_INTELLIGENCE_FILTER_NOTE,
  PROSPECT_SEARCH_ENGINE_INTELLIGENCE_FILTER_CATEGORIES,
  PROSPECT_SEARCH_ENGINE_INTELLIGENCE_FILTER_ROLES,
} from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-ux"

function toggleBooleanFilter(
  onChange: Dispatch<SetStateAction<GrowthProspectSearchFilters>>,
  key: "engine_verified_email" | "engine_verified_phone" | "engine_verified_profile",
) {
  onChange((prev) => ({ ...prev, [key]: !prev[key] }))
}

function toggleRole(
  onChange: Dispatch<SetStateAction<GrowthProspectSearchFilters>>,
  role: GrowthBuyingCommitteeIntelligenceRole,
) {
  onChange((prev) => {
    const current = prev.buying_committee_roles ?? []
    const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role]
    return {
      ...prev,
      buying_committee_roles: next.length ? next : undefined,
    }
  })
}

function toggleCategory(
  onChange: Dispatch<SetStateAction<GrowthProspectSearchFilters>>,
  category: GrowthCompanyIntelligenceCategory,
) {
  onChange((prev) => {
    const current = prev.company_intelligence_categories ?? []
    const next = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category]
    return {
      ...prev,
      company_intelligence_categories: next.length ? next : undefined,
    }
  })
}

export function ProspectSearchEngineIntelligenceFiltersCard({
  filters,
  onChange,
}: {
  filters: GrowthProspectSearchFilters
  onChange: Dispatch<SetStateAction<GrowthProspectSearchFilters>>
}) {
  return (
    <div
      className="space-y-3"
      data-qa-marker={GROWTH_PROSPECT_SEARCH_INTELLIGENCE_UX_QA_MARKER}
      data-engine-intelligence-filters="v1"
    >
      <div>
        <p className="text-xs font-semibold text-sky-950">{PROSPECT_SEARCH_ENGINE_FILTER_SECTION_LABEL}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{PROSPECT_SEARCH_ENGINE_FILTER_SECTION_HELPER}</p>
        <p className="mt-1 text-[11px] text-sky-800">{PROSPECT_SEARCH_ENGINE_INTELLIGENCE_FILTER_NOTE}</p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Verified channels (company-level)</p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["engine_verified_email", "Verified email"],
              ["engine_verified_phone", "Verified phone"],
              ["engine_verified_profile", "Verified social profile"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleBooleanFilter(onChange, key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                filters[key]
                  ? "border-sky-500 bg-sky-50 text-sky-950"
                  : "border-border hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Buying committee roles</p>
        <div className="flex flex-wrap gap-1.5">
          {PROSPECT_SEARCH_ENGINE_INTELLIGENCE_FILTER_ROLES.map((role) => {
            const active = filters.buying_committee_roles?.includes(role) ?? false
            return (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(onChange, role)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  active ? "border-violet-400 bg-violet-50 text-violet-950" : "border-border hover:bg-muted",
                )}
              >
                {PROSPECT_SEARCH_BUYING_COMMITTEE_ROLE_LABELS[role]}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Company intelligence categories</p>
        <div className="flex flex-wrap gap-1.5">
          {PROSPECT_SEARCH_ENGINE_INTELLIGENCE_FILTER_CATEGORIES.map((category) => {
            const active = filters.company_intelligence_categories?.includes(category) ?? false
            return (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategory(onChange, category)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  active ? "border-teal-400 bg-teal-50 text-teal-950" : "border-border hover:bg-muted",
                )}
              >
                {PROSPECT_SEARCH_COMPANY_INTELLIGENCE_CATEGORY_LABELS[category]}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
