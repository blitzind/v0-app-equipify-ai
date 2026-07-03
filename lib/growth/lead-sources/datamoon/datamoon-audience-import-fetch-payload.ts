/** GE-DATAMOON-NESTED-FETCH-RECORDS-FIX-1 — Extract Datamoon fetch payload from nested module envelopes. Client-safe. */

import { summarizeDatamoonBuildResponseKeys } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-build-id"

export { summarizeDatamoonBuildResponseKeys as summarizeDatamoonFetchResponseKeys }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readProviderStatus(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function resolveNestedLayers(data: Record<string, unknown>): Record<string, unknown>[] {
  const layers = [data]
  const nested = data.data
  if (isPlainObject(nested)) {
    layers.push(nested)
    const doubleNested = nested.data
    if (isPlainObject(doubleNested)) layers.push(doubleNested)
  }
  return layers
}

function resolveFirstMatchingValue<T>(
  layers: Record<string, unknown>[],
  read: (layer: Record<string, unknown>) => T | null,
): T | null {
  for (const layer of layers) {
    const value = read(layer)
    if (value != null) return value
  }
  return null
}

export function resolveDatamoonFetchPayload(data: unknown): {
  providerStatus: string
  records: unknown[]
  recordCount: number
} {
  if (!isPlainObject(data)) {
    return { providerStatus: "in_progress", records: [], recordCount: 0 }
  }

  const layers = resolveNestedLayers(data)
  const providerStatus =
    resolveFirstMatchingValue(layers, (layer) => readProviderStatus(layer.status)) ?? "in_progress"
  const records =
    resolveFirstMatchingValue(layers, (layer) => (Array.isArray(layer.records) ? layer.records : null)) ?? []
  const recordCount =
    resolveFirstMatchingValue(layers, (layer) =>
      typeof layer.record_count === "number" && Number.isFinite(layer.record_count)
        ? Math.trunc(layer.record_count)
        : null,
    ) ?? records.length

  return { providerStatus, records, recordCount }
}
