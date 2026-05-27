"use client"

import type { Dispatch, SetStateAction } from "react"
import { SmartFilterInput } from "@/components/growth/prospect-search/smart-filter-input"
import type {
  GrowthProspectSearchFilters,
  GrowthProspectSearchTerritoryFilter,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

const COMMON_STATES = ["TN", "TX", "CA", "FL", "GA", "NC", "OH", "NY"] as const

function parseTagInput(raw: string): string[] {
  return raw
    .split(/[,|]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function TerritoryFilterCard({
  filters,
  onChange,
}: {
  filters: GrowthProspectSearchFilters
  onChange: Dispatch<SetStateAction<GrowthProspectSearchFilters>>
}) {
  const territory = filters.territory_filter ?? {}
  const selectedStates = territory.states ?? []

  function patchTerritory(patch: Partial<GrowthProspectSearchTerritoryFilter>) {
    const next = { ...territory, ...patch }
    const hasValues =
      next.country ||
      next.states?.length ||
      next.cities?.length ||
      next.metros?.length ||
      next.postal_codes?.length ||
      next.radius
    onChange((prev) => ({
      ...prev,
      territory_filter: hasValues ? next : undefined,
    }))
  }

  function toggleState(state: string) {
    const next = selectedStates.includes(state)
      ? selectedStates.filter((value) => value !== state)
      : [...selectedStates, state]
    patchTerritory({ states: next.length ? next : undefined })
  }

  return (
    <div className="space-y-3" data-qa-marker="growth-prospect-search-territory-filter-v1">
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">States</p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_STATES.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => toggleState(state)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                selectedStates.includes(state)
                  ? "border-sky-400 bg-sky-50 text-sky-900"
                  : "border-border hover:bg-muted",
              )}
            >
              {state}
            </button>
          ))}
        </div>
        <SmartFilterInput
          label="Additional states"
          field="location"
          value={selectedStates.join(", ")}
          onChange={(value) =>
            patchTerritory({ states: parseTagInput(value).length ? parseTagInput(value) : undefined })
          }
          placeholder="e.g. TN, Kentucky"
        />
      </div>

      <SmartFilterInput
        label="Cities / metros"
        field="location"
        value={(territory.cities ?? []).concat(territory.metros ?? []).join(", ")}
        onChange={(value) => {
          const tokens = parseTagInput(value)
          const metros = tokens.filter((token) => /metro$/i.test(token)).map((token) => token.replace(/\s+metro$/i, ""))
          const cities = tokens.filter((token) => !/metro$/i.test(token))
          patchTerritory({
            cities: cities.length ? cities : undefined,
            metros: metros.length ? metros : undefined,
          })
        }}
        placeholder="e.g. Nashville, Greeneville, Nashville metro"
      />

      <SmartFilterInput
        label="ZIP / postal codes"
        field="location"
        value={(territory.postal_codes ?? []).join(", ")}
        onChange={(value) =>
          patchTerritory({
            postal_codes: parseTagInput(value).length ? parseTagInput(value) : undefined,
          })
        }
        placeholder="e.g. 37745, 37201"
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <SmartFilterInput
          label="Radius center label"
          field="location"
          value={territory.radius?.label ?? ""}
          onChange={(value) => {
            const radius = territory.radius
            if (!radius?.center_lat || !radius.center_lng || !radius.miles) return
            patchTerritory({
              radius: {
                ...radius,
                label: value || undefined,
              },
            })
          }}
          placeholder="e.g. Nashville"
        />
        <SmartFilterInput
          label="Center lat"
          field="location"
          value={territory.radius?.center_lat != null ? String(territory.radius.center_lat) : ""}
          onChange={(value) => {
            const center_lat = Number.parseFloat(value)
            const center_lng = territory.radius?.center_lng
            const miles = territory.radius?.miles
            if (!Number.isFinite(center_lat) || center_lng == null || miles == null) {
              if (!value.trim()) patchTerritory({ radius: undefined })
              return
            }
            patchTerritory({
              radius: {
                center_lat,
                center_lng,
                miles,
                label: territory.radius?.label,
              },
            })
          }}
          placeholder="36.1627"
        />
        <SmartFilterInput
          label="Center lng"
          field="location"
          value={territory.radius?.center_lng != null ? String(territory.radius.center_lng) : ""}
          onChange={(value) => {
            const center_lng = Number.parseFloat(value)
            const center_lat = territory.radius?.center_lat
            const miles = territory.radius?.miles
            if (!Number.isFinite(center_lng) || center_lat == null || miles == null) {
              if (!value.trim()) patchTerritory({ radius: undefined })
              return
            }
            patchTerritory({
              radius: {
                center_lat,
                center_lng,
                miles,
                label: territory.radius?.label,
              },
            })
          }}
          placeholder="-86.7816"
        />
      </div>

      <SmartFilterInput
        label="Radius miles"
        field="location"
        value={territory.radius?.miles != null ? String(territory.radius.miles) : ""}
        onChange={(value) => {
          const miles = Number.parseFloat(value)
          const center_lat = territory.radius?.center_lat
          const center_lng = territory.radius?.center_lng
          if (!Number.isFinite(miles) || center_lat == null || center_lng == null) {
            if (!value.trim()) patchTerritory({ radius: undefined })
            return
          }
          patchTerritory({
            radius: {
              center_lat,
              center_lng,
              miles,
              label: territory.radius?.label,
            },
          })
        }}
        placeholder="25"
      />

      <p className="text-[11px] text-muted-foreground">
        Radius uses indexed coordinates only. Companies without lat/lng are excluded when radius is active.
      </p>
    </div>
  )
}
