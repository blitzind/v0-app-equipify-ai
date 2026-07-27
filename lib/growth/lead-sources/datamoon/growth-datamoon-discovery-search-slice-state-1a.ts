/** AVA-DISCOVERY-SEARCH-DIVERSITY-AND-EXHAUSTION-1A — Persist search slice state in org memory (server-only). */

import "server-only"

import {
  emptyDatamoonDiscoverySearchSliceState,
  GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER,
  type DatamoonDiscoverySearchSliceState,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a-types"
import { parsePortfolioManagerMemoryFromStore } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-memory-1a"
import type { GrowthPortfolioManagerMemory } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import { persistPortfolioManagerMemoryPreferences } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-memory-persistence-1a"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { AvaOrganizationalMemoryStore } from "@/lib/growth/memory/types"

export const GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_MEMORY_KEY =
  "ava-discovery-search-diversity-and-exhaustion-1a" as const

export function readDiscoverySearchSliceStateFromPortfolioMemory(
  memory: GrowthPortfolioManagerMemory,
): DatamoonDiscoverySearchSliceState {
  const raw = memory.discoverySearchSliceState
  if (!raw || raw.qaMarker !== GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER) {
    return emptyDatamoonDiscoverySearchSliceState()
  }
  return raw
}

export async function loadDiscoverySearchSliceState(
  admin: SupabaseClient,
  input: {
    organizationId: string
    organizationalMemory?: AvaOrganizationalMemoryStore | null
  },
): Promise<DatamoonDiscoverySearchSliceState> {
  let store = input.organizationalMemory
  if (!store) {
    const { fetchOrganizationMemoryStore } = await import(
      "@/lib/growth/memory/storage/organization-memory-repository"
    )
    store = await fetchOrganizationMemoryStore(admin, {
      organizationId: input.organizationId,
      generatedAt: new Date().toISOString(),
    })
  }
  const memory = parsePortfolioManagerMemoryFromStore(store)
  return readDiscoverySearchSliceStateFromPortfolioMemory(memory)
}

export async function persistDiscoverySearchSliceState(
  admin: SupabaseClient,
  input: {
    organizationId: string
    memory: GrowthPortfolioManagerMemory
    sliceState: DatamoonDiscoverySearchSliceState
    generatedAt: string
  },
): Promise<void> {
  const nextMemory: GrowthPortfolioManagerMemory = {
    ...input.memory,
    discoverySearchSliceState: input.sliceState,
  }
  await persistPortfolioManagerMemoryPreferences(admin, {
    organizationId: input.organizationId,
    memory: nextMemory,
    generatedAt: input.generatedAt,
    reason: "slice_outcome",
  })
}

export function mergeDiscoverySearchSliceIntoPortfolioMemory(
  memory: GrowthPortfolioManagerMemory,
  sliceState: DatamoonDiscoverySearchSliceState,
): GrowthPortfolioManagerMemory {
  return {
    ...memory,
    discoverySearchSliceState: sliceState,
  }
}
