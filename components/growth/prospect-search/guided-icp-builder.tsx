"use client"

import { FilterGroupCard } from "@/components/growth/prospect-search/filter-group-card"
import { RecommendedFilters } from "@/components/growth/prospect-search/recommended-filters"
import { SmartFilterInput } from "@/components/growth/prospect-search/smart-filter-input"
import { TitleTargetingCard } from "@/components/growth/prospect-search/title-targeting-card"
import { TerritoryFilterCard } from "@/components/growth/prospect-search/territory-filter-card"
import {
  PROSPECT_SEARCH_EMPLOYEE_BANDS_UI,
  PROSPECT_SEARCH_INTENT_PRESETS,
  PROSPECT_SEARCH_TECHNOLOGIES,
  employeeBandUiToBackend,
  employeeBandsBackendToUi,
  intentPresetToFilters,
  type ProspectSearchEmployeeBandUi,
  type ProspectSearchIntentPresetId,
} from "@/components/growth/prospect-search/prospect-search-ux-constants"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

export function GuidedIcpBuilder({
  filters,
  onChange,
  onApply,
  onClear,
}: {
  filters: GrowthProspectSearchFilters
  onChange: (filters: GrowthProspectSearchFilters) => void
  onApply: () => void
  onClear: () => void
}) {
  const selectedBands = employeeBandsBackendToUi(filters.employee_size_bands)
  const activeIntent = detectActiveIntentPreset(filters)

  function toggleBand(band: ProspectSearchEmployeeBandUi) {
    const next = selectedBands.includes(band)
      ? selectedBands.filter((b) => b !== band)
      : [...selectedBands, band]
    const backend = next.flatMap((b) => employeeBandUiToBackend(b))
    onChange({
      ...filters,
      employee_size_bands: backend.length ? (backend as GrowthProspectSearchFilters["employee_size_bands"]) : undefined,
    })
  }

  function toggleTechnology(tech: string) {
    const list = filters.technologies ?? []
    const next = list.includes(tech) ? list.filter((t) => t !== tech) : [...list, tech]
    onChange({
      ...filters,
      technologies: next.length ? next : undefined,
      crm_detected: tech.match(/salesforce|hubspot|zoho/i) ? tech : filters.crm_detected,
      field_service_software: tech.match(/servicetitan|housecall|fieldpulse/i)
        ? tech
        : filters.field_service_software,
    })
  }

  function applyIntentPreset(id: ProspectSearchIntentPresetId) {
    onChange({ ...filters, ...intentPresetToFilters(id) })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Guided ICP Builder</h2>
          <p className="text-xs text-muted-foreground">
            Structured filters — dropdowns, chips, and smart suggestions (no spreadsheet).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onApply}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm"
          >
            Apply & search
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FilterGroupCard title="Industry" description="Vertical focus for your ICP">
          <SmartFilterInput
            label="Primary industry"
            field="industry"
            value={filters.industry ?? ""}
            onChange={(v) => onChange({ ...filters, industry: v || null })}
            placeholder="e.g. HVAC, Biomedical"
          />
          <RecommendedFilters
            field="industry"
            query={filters.industry ?? ""}
            onPick={(v) => onChange({ ...filters, industry: v })}
          />
        </FilterGroupCard>

        <FilterGroupCard title="Company size" description="Employee count bands">
          <div className="flex flex-wrap gap-1.5">
            {PROSPECT_SEARCH_EMPLOYEE_BANDS_UI.map((band) => (
              <button
                key={band}
                type="button"
                onClick={() => toggleBand(band)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  selectedBands.includes(band)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted",
                )}
              >
                {band}
              </button>
            ))}
          </div>
        </FilterGroupCard>

        <FilterGroupCard title="Location" description="Free-text region (backward compatible)">
          <SmartFilterInput
            label="Location"
            field="location"
            value={filters.location ?? ""}
            onChange={(v) => onChange({ ...filters, location: v || null })}
            placeholder="e.g. California, Tennessee"
          />
          <RecommendedFilters
            field="location"
            query={filters.location ?? ""}
            onPick={(v) => onChange({ ...filters, location: v })}
          />
        </FilterGroupCard>

        <FilterGroupCard title="Territory" description="Structured state, city, ZIP, and radius filters">
          <TerritoryFilterCard filters={filters} onChange={onChange} />
        </FilterGroupCard>

        <FilterGroupCard title="Intent" description="Observable buying & traffic signals">
          <div className="flex flex-wrap gap-1.5">
            {PROSPECT_SEARCH_INTENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                title={preset.description}
                onClick={() => applyIntentPreset(preset.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  activeIntent === preset.id
                    ? "border-violet-400 bg-violet-50 text-violet-900"
                    : "border-border hover:bg-muted",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </FilterGroupCard>

        <FilterGroupCard title="Technology" description="CRM & field service stack">
          <div className="flex flex-wrap gap-1.5">
            {PROSPECT_SEARCH_TECHNOLOGIES.map((tech) => {
              const active =
                (filters.technologies ?? []).includes(tech) ||
                filters.crm_detected === tech ||
                filters.field_service_software === tech
              return (
                <button
                  key={tech}
                  type="button"
                  onClick={() => toggleTechnology(tech)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium",
                    active ? "border-cyan-400 bg-cyan-50 text-cyan-900" : "border-border hover:bg-muted",
                  )}
                >
                  {tech}
                </button>
              )
            })}
          </div>
        </FilterGroupCard>

        <FilterGroupCard title="Title targeting" description="Decision maker roles & titles">
          <TitleTargetingCard filters={filters} onChange={onChange} />
        </FilterGroupCard>

        <FilterGroupCard title="Account safety" description="Existing accounts and outreach suppression">
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Existing accounts</p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["any", "Show all"],
                    ["exclude_customers", "Exclude customers"],
                    ["exclude_crm", "Exclude customers + prospects"],
                    ["include_only", "Only existing accounts"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onChange({ ...filters, existing_account_mode: mode })}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium",
                      (filters.existing_account_mode ?? "any") === mode
                        ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Suppressed contacts</p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["exclude", "Hide suppressed"],
                    ["any", "Include suppressed"],
                    ["suppressed_only", "Suppressed only"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onChange({ ...filters, suppression_mode: mode })}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium",
                      (filters.suppression_mode ?? "exclude") === mode
                        ? "border-red-300 bg-red-50 text-red-900"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </FilterGroupCard>
      </div>
    </div>
  )
}

function detectActiveIntentPreset(
  filters: GrowthProspectSearchFilters,
): ProspectSearchIntentPresetId | null {
  for (const preset of PROSPECT_SEARCH_INTENT_PRESETS) {
    const patch = intentPresetToFilters(preset.id)
    if (
      patch.intent_score_min != null &&
      filters.intent_score_min === patch.intent_score_min
    ) {
      return preset.id
    }
    if (patch.returning_visitor_only && filters.returning_visitor_only) return preset.id
    if (
      patch.buying_stages?.[0] &&
      filters.buying_stages?.includes(patch.buying_stages[0])
    ) {
      return preset.id
    }
    if (
      patch.search_intent_categories?.[0] &&
      filters.search_intent_categories?.includes(patch.search_intent_categories[0])
    ) {
      return preset.id
    }
  }
  return null
}
