/** GE-AVA-MISSION-RUNTIME-1B — Find Leads mission binding display helpers (client-safe). */

import type { DatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import type { GrowthMissionRuntimeDatamoonBinding } from "@/lib/growth/mission-center/growth-mission-runtime-types"

export const GROWTH_AVA_MISSION_RUNTIME_1B_QA_MARKER = "ge-ava-mission-runtime-1b-v1" as const

export function parseLookbackDaysFromDatamoonRequest(request: DatamoonAudienceImportRequest): number | null {
  const filter = request.filters.find((entry) => entry.field === "lookback_days")
  if (!filter?.value) return null
  const parsed = Number(filter.value)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseIntentLevelsFromDatamoonRequest(request: DatamoonAudienceImportRequest): string[] {
  const filter = request.filters.find((entry) => entry.field === "intent_level")
  if (!filter?.value) return []
  if (Array.isArray(filter.value)) return filter.value.map(String)
  return [String(filter.value)]
}

export function requestHasOnlyNewSinceLastRefresh(request: DatamoonAudienceImportRequest): boolean {
  return request.filters.some(
    (entry) => entry.field === "only_new_since_last_refresh" && String(entry.value) === "true",
  )
}

export function formatMissionFindLeadsMonitoringStatus(binding: GrowthMissionRuntimeDatamoonBinding | null): string {
  if (!binding?.keepMonitoring) return "Not monitoring"
  return "Monitoring lead search"
}

export function buildLeadDiscoveryDetailItems(binding: GrowthMissionRuntimeDatamoonBinding | null): string[] {
  if (!binding?.importRequestJson) return []
  const items: string[] = []
  if (binding.searchSummary?.trim()) items.push(`Search: ${binding.searchSummary.trim()}`)
  if (binding.audienceName?.trim()) items.push(`Audience: ${binding.audienceName.trim()}`)
  if (binding.boundAt) items.push(`Attached: ${new Date(binding.boundAt).toLocaleDateString()}`)
  if (binding.lastRunId) items.push(`Last run: ${binding.lastRunId.slice(0, 8)}…`)
  if (binding.lastPollAt) items.push(`Last refresh: ${new Date(binding.lastPollAt).toLocaleDateString()}`)
  if (binding.lastImportedCount > 0) items.push(`New leads imported: ${binding.lastImportedCount}`)
  if (binding.keepMonitoring) {
    items.push(`Monitoring: ${binding.refreshCadence ?? "daily"}`)
  }
  return items
}

export function selectDefaultFindLeadsMissionId(
  objectives: Array<{ id: string; title: string; status: string; objectiveType: string; runtime?: { running?: boolean } | null }>,
): string | null {
  const active = objectives.filter((entry) => entry.status === "active" && entry.runtime?.running)
  const preferredTypes = ["customers_acquired", "opportunities_created", "pipeline_value"]
  for (const type of preferredTypes) {
    const match = active.find((entry) => entry.objectiveType === type)
    if (match) return match.id
  }
  return active[0]?.id ?? null
}

export function buildLeadDiscoveryAdvancedItems(binding: GrowthMissionRuntimeDatamoonBinding | null): string[] {
  if (!binding) return []
  const items: string[] = []
  if (binding.provider) items.push(`Provider: ${binding.provider}`)
  if (binding.source) items.push(`Source: ${binding.source}`)
  if (binding.lookbackDays != null) items.push(`Lookback: ${binding.lookbackDays} days`)
  if (binding.intentLevels?.length) items.push(`Intent: ${binding.intentLevels.join(", ")}`)
  if (binding.onlyNewSinceLastRefresh) items.push("Only new since last refresh")
  return items
}
