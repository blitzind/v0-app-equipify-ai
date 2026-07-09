/** GE-AIOS-12A — Canonical organizational memory persistence (single store). */

import type { AvaOrganizationalMemoryStore } from "@/lib/growth/memory/types"
import { AVA_ORGANIZATIONAL_MEMORY_STORAGE_KEY } from "@/lib/growth/memory/types"

export function readOrganizationalMemoryStore(): AvaOrganizationalMemoryStore | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(AVA_ORGANIZATIONAL_MEMORY_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AvaOrganizationalMemoryStore
  } catch {
    return null
  }
}

export function writeOrganizationalMemoryStore(store: AvaOrganizationalMemoryStore): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(AVA_ORGANIZATIONAL_MEMORY_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore
  }
}

export function mergeOrganizationalMemoryStore(
  existing: AvaOrganizationalMemoryStore | null,
  incoming: AvaOrganizationalMemoryStore,
): AvaOrganizationalMemoryStore {
  const eventIds = new Set((existing?.events ?? []).map((row) => row.id))
  const preferenceIds = new Set((existing?.preferences ?? []).map((row) => row.id))

  const mergedEvents = [...(existing?.events ?? [])]
  for (const event of incoming.events) {
    if (eventIds.has(event.id)) continue
    mergedEvents.push(event)
    eventIds.add(event.id)
  }

  const mergedPreferences = [...(existing?.preferences ?? [])]
  for (const preference of incoming.preferences) {
    if (preferenceIds.has(preference.id)) continue
    mergedPreferences.push(preference)
    preferenceIds.add(preference.id)
  }

  return {
    capturedAt: incoming.capturedAt,
    organizationId: incoming.organizationId,
    events: mergedEvents.slice(-500),
    preferences: mergedPreferences.slice(-50),
  }
}
