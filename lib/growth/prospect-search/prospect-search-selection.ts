import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export function prospectSearchSelectionKey(
  row: Pick<GrowthProspectSearchCompanyResult, "source_type" | "id">,
): string {
  return `${row.source_type}:${row.id}`
}
