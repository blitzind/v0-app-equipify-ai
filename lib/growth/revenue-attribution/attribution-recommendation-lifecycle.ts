/** Client-side lifecycle for attribution recommendations (reviewed / dismissed). */

export const GROWTH_ATTRIBUTION_REC_LIFECYCLE_STORAGE_KEY =
  "growth-attribution-rec-lifecycle-v1" as const

export type GrowthAttributionRecLifecycleState = "active" | "reviewed" | "dismissed"

export type GrowthAttributionRecLifecycleEntry = {
  state: GrowthAttributionRecLifecycleState
  updatedAt: string
}

export type GrowthAttributionRecLifecycleMap = Record<string, GrowthAttributionRecLifecycleEntry>

export function readAttributionRecLifecycle(): GrowthAttributionRecLifecycleMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(GROWTH_ATTRIBUTION_REC_LIFECYCLE_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as GrowthAttributionRecLifecycleMap
  } catch {
    return {}
  }
}

export function writeAttributionRecLifecycle(map: GrowthAttributionRecLifecycleMap): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(GROWTH_ATTRIBUTION_REC_LIFECYCLE_STORAGE_KEY, JSON.stringify(map))
}

export function setAttributionRecLifecycle(
  id: string,
  state: GrowthAttributionRecLifecycleState,
): GrowthAttributionRecLifecycleMap {
  const map = readAttributionRecLifecycle()
  map[id] = { state, updatedAt: new Date().toISOString() }
  writeAttributionRecLifecycle(map)
  return map
}
