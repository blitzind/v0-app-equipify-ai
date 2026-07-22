/** GE-DATAMOON-NESTED-FETCH-RECORDS-FIX-1 / PAGINATED-FETCH-ROWS-FIX-1 — Extract Datamoon fetch payload from nested/paginated envelopes. Client-safe. */

import { summarizeDatamoonBuildResponseKeys } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-build-id"

export { summarizeDatamoonBuildResponseKeys as summarizeDatamoonFetchResponseKeys }

export const GROWTH_DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATE_1A_QA_MARKER =
  "ge-aios-datamoon-discovery-terminal-state-1a-v1" as const

/** Canonical terminal provider audience job statuses (HTTP fetch succeeded). */
export const DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATUSES = [
  "failed",
  "error",
  "cancelled",
  "canceled",
  "expired",
  "aborted",
  "terminated",
] as const

const DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATUS_SET = new Set<string>(
  DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATUSES,
)

export type DatamoonAudienceProviderTerminalStatus =
  (typeof DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATUSES)[number]

export function normalizeDatamoonAudienceProviderStatus(status: string | null | undefined): string {
  if (!status?.trim()) return "in_progress"
  return status.trim().toLowerCase()
}

export function isDatamoonAudienceProviderTerminalStatus(status: string | null | undefined): boolean {
  return DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATUS_SET.has(normalizeDatamoonAudienceProviderStatus(status))
}

export function isDatamoonAudienceProviderPollCompleteStatus(status: string | null | undefined): boolean {
  return normalizeDatamoonAudienceProviderStatus(status) === "completed"
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readProviderStatus(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readFiniteInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.trunc(value)
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

function resolveFetchRecords(data: Record<string, unknown>): unknown[] {
  const layers = resolveNestedLayers(data)
  const fromRecordsKey = resolveFirstMatchingValue(layers, (layer) =>
    Array.isArray(layer.records) ? layer.records : null,
  )
  if (fromRecordsKey) return fromRecordsKey

  const pagination = data.data
  if (isPlainObject(pagination)) {
    if (Array.isArray(pagination.data)) return pagination.data

    const inner = pagination.data
    if (isPlainObject(inner) && Array.isArray(inner.records)) return inner.records
  }

  return []
}

function resolveFetchRecordCount(data: Record<string, unknown>, records: unknown[]): number {
  const layers = resolveNestedLayers(data)
  const fromRecordCount = resolveFirstMatchingValue(layers, (layer) => readFiniteInt(layer.record_count))
  if (fromRecordCount != null) return fromRecordCount

  const pagination = data.data
  if (isPlainObject(pagination)) {
    const paginationTotal = readFiniteInt(pagination.total)
    if (paginationTotal != null) return paginationTotal
  }

  const counts = data.counts
  if (isPlainObject(counts)) {
    const countsTotal = readFiniteInt(counts.total)
    if (countsTotal != null) return countsTotal
  }

  return records.length
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
  const records = resolveFetchRecords(data)
  const recordCount = resolveFetchRecordCount(data, records)

  return { providerStatus, records, recordCount }
}

function readProviderMessage(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function resolveDatamoonAudienceProviderTerminalFailureMessage(input: {
  providerStatus: string
  fetchData: unknown
}): string {
  const normalizedStatus = normalizeDatamoonAudienceProviderStatus(input.providerStatus)
  if (isPlainObject(input.fetchData)) {
    const layers = resolveNestedLayers(input.fetchData)
    const detail =
      resolveFirstMatchingValue(layers, (layer) => readProviderMessage(layer.message)) ??
      resolveFirstMatchingValue(layers, (layer) => readProviderMessage(layer.error)) ??
      resolveFirstMatchingValue(layers, (layer) => readProviderMessage(layer.error_message))
    if (detail) {
      return `Datamoon audience provider terminal status (${normalizedStatus}): ${detail}`.slice(0, 200)
    }
  }
  return `Datamoon audience provider terminal status: ${normalizedStatus}`.slice(0, 200)
}
