/** Client-side lifecycle for sequence optimization recommendations. */

export const GROWTH_SEQUENCE_OPTIMIZATION_REC_LIFECYCLE_STORAGE_KEY =
  "growth-sequence-optimization-rec-lifecycle-v1" as const

export type GrowthSequenceOptimizationRecLifecycleState = "active" | "reviewed" | "dismissed"

export type GrowthSequenceOptimizationRecLifecycleEntry = {
  state: GrowthSequenceOptimizationRecLifecycleState
  updatedAt: string
}

export type GrowthSequenceOptimizationRecLifecycleMap = Record<
  string,
  GrowthSequenceOptimizationRecLifecycleEntry
>

export function readSequenceOptimizationRecLifecycle(): GrowthSequenceOptimizationRecLifecycleMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(GROWTH_SEQUENCE_OPTIMIZATION_REC_LIFECYCLE_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as GrowthSequenceOptimizationRecLifecycleMap
  } catch {
    return {}
  }
}

export function writeSequenceOptimizationRecLifecycle(
  map: GrowthSequenceOptimizationRecLifecycleMap,
): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(GROWTH_SEQUENCE_OPTIMIZATION_REC_LIFECYCLE_STORAGE_KEY, JSON.stringify(map))
}

export function setSequenceOptimizationRecLifecycle(
  id: string,
  state: GrowthSequenceOptimizationRecLifecycleState,
): GrowthSequenceOptimizationRecLifecycleMap {
  const map = readSequenceOptimizationRecLifecycle()
  map[id] = { state, updatedAt: new Date().toISOString() }
  writeSequenceOptimizationRecLifecycle(map)
  return map
}
