/** Territory builder — infer territory type from filter shape. Client-safe. */

import type { GrowthProspectSearchTerritoryFilter } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthTerritoryType } from "@/lib/growth/territory-intelligence/territory-intelligence-types"

export function inferTerritoryType(filter: GrowthProspectSearchTerritoryFilter): GrowthTerritoryType {
  if (filter.radius?.center_lat != null && filter.radius?.center_lng != null && filter.radius.miles > 0) {
    return "radius"
  }
  if (filter.postal_codes?.length) return "postal_code"
  if (filter.cities?.length || filter.metros?.length) return "city_metro"
  if (filter.states?.length) return "state"
  return "custom"
}

export function buildTerritoryName(input: {
  name?: string | null
  territory_filter: GrowthProspectSearchTerritoryFilter
  industry?: string | null
}): string {
  if (input.name?.trim()) return input.name.trim().slice(0, 120)

  const parts: string[] = []
  if (input.territory_filter.radius?.label) parts.push(input.territory_filter.radius.label)
  else if (input.territory_filter.states?.length) parts.push(input.territory_filter.states.join(", "))
  else if (input.territory_filter.cities?.length) parts.push(input.territory_filter.cities.join(", "))
  else if (input.territory_filter.postal_codes?.length) {
    parts.push(`ZIP ${input.territory_filter.postal_codes.slice(0, 3).join(", ")}`)
  }

  if (input.industry?.trim()) parts.push(input.industry.trim())
  return parts.join(" · ").slice(0, 120) || "Custom territory"
}
