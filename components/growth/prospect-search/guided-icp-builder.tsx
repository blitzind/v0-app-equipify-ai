"use client"

import { RecommendedFilters } from "@/components/growth/prospect-search/recommended-filters"
import { SmartFilterInput } from "@/components/growth/prospect-search/smart-filter-input"
import { TitleTargetingCard } from "@/components/growth/prospect-search/title-targeting-card"
import { TerritoryFilterCard } from "@/components/growth/prospect-search/territory-filter-card"
import {
  PROSPECT_SEARCH_BUYING_STAGE_UI,
  PROSPECT_SEARCH_CONFIDENCE_PRESETS,
  PROSPECT_SEARCH_EMPLOYEE_BANDS_UI,
  PROSPECT_SEARCH_INTENT_PRESETS,
  PROSPECT_SEARCH_LEAD_SCORE_PRESETS,
  PROSPECT_SEARCH_REVENUE_BANDS_UI,
  PROSPECT_SEARCH_TECHNOLOGIES,
  employeeBandUiToBackend,
  employeeBandsBackendToUi,
  intentPresetToFilters,
  type ProspectSearchEmployeeBandUi,
  type ProspectSearchIntentPresetId,
} from "@/components/growth/prospect-search/prospect-search-ux-constants"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { GrowthBuyingStage } from "@/lib/growth/buying-stage/buying-stage-types"
import type {
  GrowthProspectSearchFilters,
  GrowthProspectSearchRevenueBand,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

function FilterActions({
  onClear,
  onApply,
  className,
}: {
  onClear: () => void
  onApply: () => void
  className?: string
}) {
  return (
    <div className={cn("flex gap-2", className)}>
      <button
        type="button"
        onClick={onClear}
        className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
      >
        Clear all
      </button>
      <button
        type="button"
        onClick={onApply}
        className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm"
      >
        Apply & search
      </button>
    </div>
  )
}

export function GuidedIcpBuilder({
  filters,
  onChange,
  onApply,
  onClear,
  variant = "default",
}: {
  filters: GrowthProspectSearchFilters
  onChange: (filters: GrowthProspectSearchFilters) => void
  onApply: () => void
  onClear: () => void
  variant?: "default" | "rail"
}) {
  const selectedBands = employeeBandsBackendToUi(filters.employee_size_bands)
  const activeIntent = detectActiveIntentPreset(filters)
  const isRail = variant === "rail"

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

  const accordionDefaults = ["industry", "company-size", "location", "territory"]

  return (
    <div className={cn("space-y-3", isRail ? "" : "space-y-4")}>
      {!isRail ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Guided ICP Builder</h2>
            <p className="text-xs text-muted-foreground">
              Structured filters — dropdowns, chips, and smart suggestions (no spreadsheet).
            </p>
          </div>
          <FilterActions onClear={onClear} onApply={onApply} />
        </div>
      ) : (
        <FilterActions onClear={onClear} onApply={onApply} />
      )}

      <Accordion
        type="multiple"
        defaultValue={accordionDefaults}
        className={cn(isRail && "rounded-lg border border-border/60 bg-muted/10 px-1")}
      >
        <AccordionItem value="industry" className="border-border/60 px-2">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">Industry</AccordionTrigger>
          <AccordionContent className="space-y-2 pb-3">
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
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="company-size" className="border-border/60 px-2">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">Company size</AccordionTrigger>
          <AccordionContent className="pb-3">
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
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="location" className="border-border/60 px-2">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">Location</AccordionTrigger>
          <AccordionContent className="space-y-2 pb-3">
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
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="territory" className="border-border/60 px-2">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">Territory</AccordionTrigger>
          <AccordionContent className="pb-3">
            <TerritoryFilterCard filters={filters} onChange={onChange} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="intent" className="border-border/60 px-2">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">Buying stage / intent</AccordionTrigger>
          <AccordionContent className="space-y-3 pb-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Intent presets</p>
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
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Buying stage</p>
              <div className="flex flex-wrap gap-1.5">
                {PROSPECT_SEARCH_BUYING_STAGE_UI.map((stage) => {
                  const active = (filters.buying_stages ?? []).includes(stage.id as GrowthBuyingStage)
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => {
                        const current = filters.buying_stages ?? []
                        const next = active
                          ? current.filter((value) => value !== stage.id)
                          : [...current, stage.id as GrowthBuyingStage]
                        onChange({
                          ...filters,
                          buying_stages: next.length ? next : undefined,
                        })
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium",
                        active ? "border-indigo-400 bg-indigo-50 text-indigo-900" : "border-border hover:bg-muted",
                      )}
                    >
                      {stage.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="technology" className="border-border/60 px-2">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">Technology</AccordionTrigger>
          <AccordionContent className="pb-3">
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
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="title-targeting" className="border-border/60 px-2">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">Title targeting</AccordionTrigger>
          <AccordionContent className="pb-3">
            <TitleTargetingCard filters={filters} onChange={onChange} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="revenue" className="border-border/60 px-2">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">Revenue</AccordionTrigger>
          <AccordionContent className="pb-3">
            <div className="flex flex-wrap gap-1.5">
              {PROSPECT_SEARCH_REVENUE_BANDS_UI.map((band) => {
                const active = (filters.revenue_bands ?? []).includes(band.id as GrowthProspectSearchRevenueBand)
                return (
                  <button
                    key={band.id}
                    type="button"
                    onClick={() => {
                      const current = filters.revenue_bands ?? []
                      const next = active
                        ? current.filter((value) => value !== band.id)
                        : [...current, band.id as GrowthProspectSearchRevenueBand]
                      onChange({
                        ...filters,
                        revenue_bands: next.length ? next : undefined,
                      })
                    }}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium",
                      active ? "border-amber-400 bg-amber-50 text-amber-900" : "border-border hover:bg-muted",
                    )}
                  >
                    {band.label}
                  </button>
                )
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="confidence-fit" className="border-border/60 px-2">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">Confidence / fit</AccordionTrigger>
          <AccordionContent className="space-y-3 pb-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Lead score minimum</p>
              <div className="flex flex-wrap gap-1.5">
                {PROSPECT_SEARCH_LEAD_SCORE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...filters,
                        lead_score_min: preset.value,
                      })
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium",
                      (filters.lead_score_min ?? null) === preset.value
                        ? "border-violet-400 bg-violet-50 text-violet-900"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Decision maker confidence</p>
              <div className="flex flex-wrap gap-1.5">
                {PROSPECT_SEARCH_CONFIDENCE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...filters,
                        company_identification_confidence_min: preset.value,
                      })
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium",
                      (filters.company_identification_confidence_min ?? null) === preset.value
                        ? "border-teal-400 bg-teal-50 text-teal-900"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <SmartFilterInput
              label="Service area"
              field="location"
              value={filters.service_area ?? ""}
              onChange={(v) => onChange({ ...filters, service_area: v || null })}
              placeholder="e.g. Southeast, Dallas metro"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="account-safety" className="border-border/60 px-2">
          <AccordionTrigger className="py-3 text-sm hover:no-underline">Account safety</AccordionTrigger>
          <AccordionContent className="space-y-3 pb-3">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {isRail ? <FilterActions onClear={onClear} onApply={onApply} className="pt-1" /> : null}
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
