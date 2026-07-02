/** GE-DATAMOON-BUILD-ID-FIX-1 / NESTED-BUILD-ID-FIX-1 — Extract Datamoon provider audience IDs from build responses. Client-safe. */

const DATAMOON_PROVIDER_AUDIENCE_ID_KEYS = [
  "id",
  "audience_id",
  "audienceId",
  "audienceID",
] as const

const DATAMOON_BUILD_RESPONSE_KEY_SUMMARY_LIMIT = 20

function coerceDatamoonProviderAudienceId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }
  if (typeof value === "object") return null
  return null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function extractDatamoonProviderAudienceIdFromRecord(record: Record<string, unknown>): string | null {
  for (const key of DATAMOON_PROVIDER_AUDIENCE_ID_KEYS) {
    const extracted = coerceDatamoonProviderAudienceId(record[key])
    if (extracted) return extracted
  }
  return null
}

export function extractDatamoonProviderAudienceId(data: unknown): string | null {
  if (!isPlainObject(data)) return null

  const topLevel = extractDatamoonProviderAudienceIdFromRecord(data)
  if (topLevel) return topLevel

  const nested = data.data
  if (isPlainObject(nested)) {
    const nestedId = extractDatamoonProviderAudienceIdFromRecord(nested)
    if (nestedId) return nestedId

    const doubleNested = nested.data
    if (isPlainObject(doubleNested)) {
      const doubleNestedId = extractDatamoonProviderAudienceIdFromRecord(doubleNested)
      if (doubleNestedId) return doubleNestedId
    }
  }

  return null
}

function appendSummarizedKeys(keys: string[], prefix: string, record: Record<string, unknown>) {
  for (const key of Object.keys(record)) {
    if (keys.length >= DATAMOON_BUILD_RESPONSE_KEY_SUMMARY_LIMIT) return
    keys.push(prefix ? `${prefix}.${key}` : key)
  }
}

export function summarizeDatamoonBuildResponseKeys(data: unknown): string[] {
  if (!isPlainObject(data)) return []

  const keys: string[] = []
  appendSummarizedKeys(keys, "", data)

  const nested = data.data
  if (isPlainObject(nested)) {
    appendSummarizedKeys(keys, "data", nested)

    const doubleNested = nested.data
    if (isPlainObject(doubleNested)) {
      appendSummarizedKeys(keys, "data.data", doubleNested)
    }
  }

  return keys.slice(0, DATAMOON_BUILD_RESPONSE_KEY_SUMMARY_LIMIT)
}

export function resolveDatamoonBuildAudienceId(input: {
  buildStatus: "success" | "dry_run" | "failed" | "skipped"
  data: unknown
}): { audienceId: string | null; missingProviderAudienceId: boolean } {
  const extracted = extractDatamoonProviderAudienceId(input.data)
  if (extracted) {
    return { audienceId: extracted, missingProviderAudienceId: false }
  }
  if (input.buildStatus === "dry_run") {
    return { audienceId: "dry-run-audience-id", missingProviderAudienceId: false }
  }
  if (input.buildStatus === "success") {
    return { audienceId: null, missingProviderAudienceId: true }
  }
  return { audienceId: null, missingProviderAudienceId: false }
}
