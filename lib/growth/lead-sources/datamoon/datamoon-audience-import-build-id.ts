/** GE-DATAMOON-BUILD-ID-FIX-1 — Extract Datamoon provider audience IDs from build responses. Client-safe. */

const DATAMOON_PROVIDER_AUDIENCE_ID_KEYS = [
  "id",
  "audience_id",
  "audienceId",
  "audienceID",
] as const

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

export function extractDatamoonProviderAudienceId(data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null
  const record = data as Record<string, unknown>
  for (const key of DATAMOON_PROVIDER_AUDIENCE_ID_KEYS) {
    const extracted = coerceDatamoonProviderAudienceId(record[key])
    if (extracted) return extracted
  }
  return null
}

export function summarizeDatamoonBuildResponseKeys(data: unknown): string[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return []
  return Object.keys(data as Record<string, unknown>).slice(0, 20)
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
