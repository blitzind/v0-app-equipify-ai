/**
 * Equipify Core production certification helpers (EC-1).
 * Pure metadata transforms — no network activity.
 */

import {
  EQUIPIFY_CORE_CERTIFICATION_CATEGORIES,
  EQUIPIFY_CORE_CRITICALITIES,
  EQUIPIFY_CORE_DEPENDENCIES,
  EQUIPIFY_CORE_DEPENDENCY_INVENTORY,
  EQUIPIFY_CORE_RUNTIME_INVENTORY,
  EQUIPIFY_CORE_RUNTIME_KINDS,
  type EquipifyCoreCertificationCategory,
  type EquipifyCoreCriticality,
  type EquipifyCoreDependency,
  type EquipifyCoreRuntimeEntry,
  type EquipifyCoreRuntimeKind,
} from "@/lib/certification/equipify-core-runtime-inventory"

export type EquipifyCoreCertificationStatus = "untested" | "pass" | "fail"

export type EquipifyCoreCertificationItem = {
  id: string
  category: EquipifyCoreCertificationCategory
  feature: string
  route: string
  dependencies: EquipifyCoreDependency[]
  expectedResult: string
  criticality: EquipifyCoreCriticality
  status: EquipifyCoreCertificationStatus
  runtimeEntryId?: string
}

export type EquipifyCoreCategoryGroup = {
  category: EquipifyCoreCertificationCategory
  entries: EquipifyCoreRuntimeEntry[]
}

export type EquipifyCoreCertificationSummary = {
  totalRuntimeEntries: number
  byCategory: Record<EquipifyCoreCertificationCategory, number>
  byCriticality: Record<EquipifyCoreCriticality, number>
  byKind: Record<EquipifyCoreRuntimeKind, number>
  uniqueDependencies: EquipifyCoreDependency[]
  criticalRouteCount: number
  highRouteCount: number
  categoriesPresent: EquipifyCoreCertificationCategory[]
  missingCategories: EquipifyCoreCertificationCategory[]
}

export function groupByCategory(
  inventory: readonly EquipifyCoreRuntimeEntry[] = EQUIPIFY_CORE_RUNTIME_INVENTORY,
): EquipifyCoreCategoryGroup[] {
  const map = new Map<EquipifyCoreCertificationCategory, EquipifyCoreRuntimeEntry[]>()
  for (const category of EQUIPIFY_CORE_CERTIFICATION_CATEGORIES) {
    map.set(category, [])
  }
  for (const entry of inventory) {
    const bucket = map.get(entry.category)
    if (bucket) bucket.push(entry)
  }
  return EQUIPIFY_CORE_CERTIFICATION_CATEGORIES.map((category) => ({
    category,
    entries: map.get(category) ?? [],
  }))
}

export function getCriticalRoutes(
  inventory: readonly EquipifyCoreRuntimeEntry[] = EQUIPIFY_CORE_RUNTIME_INVENTORY,
  minCriticality: EquipifyCoreCriticality = "high",
): EquipifyCoreRuntimeEntry[] {
  const rank: Record<EquipifyCoreCriticality, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  }
  const threshold = rank[minCriticality]
  return inventory.filter((entry) => rank[entry.criticality] >= threshold)
}

export function getDependencies(
  inventory: readonly EquipifyCoreRuntimeEntry[] = EQUIPIFY_CORE_RUNTIME_INVENTORY,
): EquipifyCoreDependency[] {
  const seen = new Set<EquipifyCoreDependency>()
  for (const entry of inventory) {
    for (const dep of entry.dependencies) {
      seen.add(dep)
    }
  }
  return EQUIPIFY_CORE_DEPENDENCIES.filter((dep) => seen.has(dep))
}

export function getDependencyInventory(
  inventory: readonly EquipifyCoreRuntimeEntry[] = EQUIPIFY_CORE_RUNTIME_INVENTORY,
): Array<{ dependency: EquipifyCoreDependency; label: string; description: string; routeCount: number }> {
  const counts = new Map<EquipifyCoreDependency, number>()
  for (const entry of inventory) {
    for (const dep of entry.dependencies) {
      counts.set(dep, (counts.get(dep) ?? 0) + 1)
    }
  }
  return getDependencies(inventory).map((dependency) => ({
    dependency,
    label: EQUIPIFY_CORE_DEPENDENCY_INVENTORY[dependency].label,
    description: EQUIPIFY_CORE_DEPENDENCY_INVENTORY[dependency].description,
    routeCount: counts.get(dependency) ?? 0,
  }))
}

export function summarizeCertificationInventory(
  inventory: readonly EquipifyCoreRuntimeEntry[] = EQUIPIFY_CORE_RUNTIME_INVENTORY,
): EquipifyCoreCertificationSummary {
  const byCategory = Object.fromEntries(
    EQUIPIFY_CORE_CERTIFICATION_CATEGORIES.map((c) => [c, 0]),
  ) as Record<EquipifyCoreCertificationCategory, number>

  const byCriticality = Object.fromEntries(
    EQUIPIFY_CORE_CRITICALITIES.map((c) => [c, 0]),
  ) as Record<EquipifyCoreCriticality, number>

  const byKind = Object.fromEntries(
    EQUIPIFY_CORE_RUNTIME_KINDS.map((k) => [k, 0]),
  ) as Record<EquipifyCoreRuntimeKind, number>

  for (const entry of inventory) {
    byCategory[entry.category] += 1
    byCriticality[entry.criticality] += 1
    byKind[entry.kind] += 1
  }

  const categoriesPresent = EQUIPIFY_CORE_CERTIFICATION_CATEGORIES.filter((c) => byCategory[c] > 0)
  const missingCategories = EQUIPIFY_CORE_CERTIFICATION_CATEGORIES.filter((c) => byCategory[c] === 0)

  return {
    totalRuntimeEntries: inventory.length,
    byCategory,
    byCriticality,
    byKind,
    uniqueDependencies: getDependencies(inventory),
    criticalRouteCount: byCriticality.critical,
    highRouteCount: byCriticality.high,
    categoriesPresent,
    missingCategories,
  }
}

export function findRuntimeEntryById(
  id: string,
  inventory: readonly EquipifyCoreRuntimeEntry[] = EQUIPIFY_CORE_RUNTIME_INVENTORY,
): EquipifyCoreRuntimeEntry | undefined {
  return inventory.find((entry) => entry.id === id)
}

export function validateRuntimeEntry(entry: EquipifyCoreRuntimeEntry): string[] {
  const errors: string[] = []

  if (!entry.id.trim()) errors.push("missing id")
  if (!entry.route.startsWith("/")) errors.push(`route must start with /: ${entry.route}`)
  if (!EQUIPIFY_CORE_CERTIFICATION_CATEGORIES.includes(entry.category)) {
    errors.push(`unknown category: ${entry.category}`)
  }
  if (!EQUIPIFY_CORE_CRITICALITIES.includes(entry.criticality)) {
    errors.push(`unknown criticality: ${entry.criticality}`)
  }
  if (!EQUIPIFY_CORE_RUNTIME_KINDS.includes(entry.kind)) {
    errors.push(`unknown kind: ${entry.kind}`)
  }
  if (entry.dependencies.length === 0) {
    errors.push("at least one dependency required")
  }
  for (const dep of entry.dependencies) {
    if (!EQUIPIFY_CORE_DEPENDENCIES.includes(dep)) {
      errors.push(`unknown dependency: ${dep}`)
    }
  }

  const duplicateIds = EQUIPIFY_CORE_RUNTIME_INVENTORY.filter((e) => e.id === entry.id)
  if (duplicateIds.length > 1) {
    errors.push(`duplicate id: ${entry.id}`)
  }

  return errors
}

export function validateFullInventory(
  inventory: readonly EquipifyCoreRuntimeEntry[] = EQUIPIFY_CORE_RUNTIME_INVENTORY,
): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const seenIds = new Set<string>()

  for (const entry of inventory) {
    if (seenIds.has(entry.id)) {
      errors.push(`duplicate inventory id: ${entry.id}`)
    } else {
      seenIds.add(entry.id)
    }
    errors.push(...validateRuntimeEntry(entry).map((e) => `${entry.id}: ${e}`))
  }

  const summary = summarizeCertificationInventory(inventory)
  if (summary.missingCategories.length > 0) {
    errors.push(`missing categories: ${summary.missingCategories.join(", ")}`)
  }

  return { ok: errors.length === 0, errors }
}
