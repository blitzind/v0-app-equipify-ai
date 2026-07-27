/** GE-AIOS-AUTONOMOUS-PORTFOLIO-MANAGER-1A — Portfolio manager memory via org memory store (client-safe). */

import type { AvaOrganizationalMemoryStore } from "@/lib/growth/memory/types"
import {
  GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
  GROWTH_ORGANIZATION_MEMORY_PREFERENCE_IMPORTANCE_MAX,
  GROWTH_ORGANIZATION_MEMORY_PREFERENCE_IMPORTANCE_MIN,
  GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_IMPORTANCE,
  GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_KEY,
  type GrowthPortfolioManagerMemory,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"

export {
  GROWTH_ORGANIZATION_MEMORY_PREFERENCE_IMPORTANCE_MAX,
  GROWTH_ORGANIZATION_MEMORY_PREFERENCE_IMPORTANCE_MIN,
  GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_IMPORTANCE,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"

export function emptyPortfolioManagerMemory(): GrowthPortfolioManagerMemory {
  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    lastDiscoveryAt: null,
    lastDiscoveryCount: 0,
    lastDiscoveryQualityScore: null,
    discoveriesToday: 0,
    discoveriesTodayDate: null,
    averageAdmissionRate: null,
    averageQualificationRate: null,
    averageResearchSuccessRate: null,
  }
}

export function parsePortfolioManagerMemoryFromStore(
  store: AvaOrganizationalMemoryStore | null | undefined,
): GrowthPortfolioManagerMemory {
  const empty = emptyPortfolioManagerMemory()
  const preference = store?.preferences.find(
    (row) => row.key === GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_KEY,
  )
  if (!preference?.statement?.trim()) return empty

  try {
    const parsed = JSON.parse(preference.statement) as Partial<GrowthPortfolioManagerMemory>
    return {
      qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
      lastDiscoveryAt: typeof parsed.lastDiscoveryAt === "string" ? parsed.lastDiscoveryAt : null,
      lastDiscoveryCount:
        typeof parsed.lastDiscoveryCount === "number" ? parsed.lastDiscoveryCount : 0,
      lastDiscoveryQualityScore:
        typeof parsed.lastDiscoveryQualityScore === "number"
          ? parsed.lastDiscoveryQualityScore
          : null,
      discoveriesToday: typeof parsed.discoveriesToday === "number" ? parsed.discoveriesToday : 0,
      discoveriesTodayDate:
        typeof parsed.discoveriesTodayDate === "string" ? parsed.discoveriesTodayDate : null,
      averageAdmissionRate:
        typeof parsed.averageAdmissionRate === "number" ? parsed.averageAdmissionRate : null,
      averageQualificationRate:
        typeof parsed.averageQualificationRate === "number" ? parsed.averageQualificationRate : null,
      averageResearchSuccessRate:
        typeof parsed.averageResearchSuccessRate === "number"
          ? parsed.averageResearchSuccessRate
          : null,
      discoverySearchSliceState:
        parsed.discoverySearchSliceState &&
        typeof parsed.discoverySearchSliceState === "object" &&
        (parsed.discoverySearchSliceState as { qaMarker?: string }).qaMarker ===
          "ava-discovery-search-diversity-and-exhaustion-1a-v1"
          ? (parsed.discoverySearchSliceState as GrowthPortfolioManagerMemory["discoverySearchSliceState"])
          : null,
      lastDiscoverySearchSliceSelection:
        parsed.lastDiscoverySearchSliceSelection &&
        typeof parsed.lastDiscoverySearchSliceSelection === "object"
          ? (parsed.lastDiscoverySearchSliceSelection as GrowthPortfolioManagerMemory["lastDiscoverySearchSliceSelection"])
          : null,
    }
  } catch {
    return empty
  }
}

export function serializePortfolioManagerMemory(
  memory: GrowthPortfolioManagerMemory,
): string {
  return JSON.stringify(memory)
}

export function recordPortfolioDiscoveryMemory(input: {
  memory: GrowthPortfolioManagerMemory
  generatedAt: string
  discoveredCount: number
  qualityScore?: number | null
  admissionRate?: number | null
}): GrowthPortfolioManagerMemory {
  const today = input.generatedAt.slice(0, 10)
  const sameDay = input.memory.discoveriesTodayDate === today
  const discoveriesToday = (sameDay ? input.memory.discoveriesToday : 0) + input.discoveredCount

  return {
    qaMarker: GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER,
    lastDiscoveryAt: input.generatedAt,
    lastDiscoveryCount: input.discoveredCount,
    lastDiscoveryQualityScore: input.qualityScore ?? input.memory.lastDiscoveryQualityScore,
    discoveriesToday,
    discoveriesTodayDate: today,
    averageAdmissionRate: input.admissionRate ?? input.memory.averageAdmissionRate,
    averageQualificationRate: input.memory.averageQualificationRate,
    averageResearchSuccessRate: input.memory.averageResearchSuccessRate,
    discoverySearchSliceState: input.memory.discoverySearchSliceState ?? null,
    lastDiscoverySearchSliceSelection: input.memory.lastDiscoverySearchSliceSelection ?? null,
  }
}

export function portfolioManagerMemoryPreferencePayload(
  organizationId: string,
  memory: GrowthPortfolioManagerMemory,
  capturedAt: string,
) {
  return {
    id: `${organizationId}:portfolio-manager`,
    key: GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_KEY,
    statement: serializePortfolioManagerMemory(memory),
    importance: GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_IMPORTANCE,
    source: "sales_specialist" as const,
    capturedAt,
  }
}

export function isValidOrganizationMemoryPreferenceImportance(importance: number): boolean {
  return (
    Number.isInteger(importance) &&
    importance >= GROWTH_ORGANIZATION_MEMORY_PREFERENCE_IMPORTANCE_MIN &&
    importance <= GROWTH_ORGANIZATION_MEMORY_PREFERENCE_IMPORTANCE_MAX
  )
}
