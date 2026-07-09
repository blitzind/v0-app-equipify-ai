/** GE-AIOS-17B — Server organizational memory read model types (client-safe). */

import type { AvaOrganizationalMemoryStore } from "@/lib/growth/memory/types"

export const GROWTH_SERVER_ORG_MEMORY_QA_MARKER = "ge-aios-17b-server-organizational-memory-v1" as const

export const GROWTH_ORGANIZATION_MEMORY_EVENTS_TABLE = "organization_memory_events" as const
export const GROWTH_ORGANIZATION_MEMORY_PREFERENCES_TABLE = "organization_memory_preferences" as const

/** Bounded read window — matches GE-AIOS-12A store cap. */
export const GROWTH_ORGANIZATION_MEMORY_MAX_EVENTS = 500 as const
export const GROWTH_ORGANIZATION_MEMORY_MAX_PREFERENCES = 50 as const

export type GrowthHomeOrganizationMemoryPayload = {
  qaMarker: typeof GROWTH_SERVER_ORG_MEMORY_QA_MARKER
  store: AvaOrganizationalMemoryStore
  source: "server" | "empty"
  degraded: boolean
  warning: string | null
}

export type OrganizationMemoryPersistResult = {
  inserted: number
  skipped: number
  persistedEventIds: string[]
}

export function emptyOrganizationMemoryStore(input: {
  organizationId: string
  generatedAt: string
}): import("@/lib/growth/memory/types").AvaOrganizationalMemoryStore {
  return {
    organizationId: input.organizationId,
    capturedAt: input.generatedAt,
    events: [],
    preferences: [],
  }
}
