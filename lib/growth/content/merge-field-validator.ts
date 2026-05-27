/** Merge field validation for Growth content library (Phase 2S). Client-safe. */

export const GROWTH_CONTENT_MERGE_FIELD_RE = /\{\{\s*([a-z0-9_.]+)\s*\}\}/gi

export const GROWTH_CONTENT_BLOCKED_VARIABLE_PATTERNS = [
  /^provider[._]/i,
  /^secret/i,
  /^token/i,
  /^api[_-]?key/i,
  /^password/i,
  /^billing[_-]?id/i,
  /^internal[_-]?id/i,
  /^raw[_-]?provider/i,
  /^private[_-]?note/i,
  /uuid/i,
  /_id$/i,
  /^id$/i,
] as const

export const GROWTH_CONTENT_BLOCKED_VARIABLE_KEYS = new Set([
  "provider_secret",
  "provider_token",
  "provider_payload",
  "raw_token",
  "api_key",
  "password",
  "billing_id",
  "internal_id",
  "private_notes",
  "raw_provider_payload",
  "service_role_key",
  "supabase_key",
])

export function extractContentMergeFields(text: string | null | undefined): string[] {
  if (!text?.trim()) return []
  const keys = new Set<string>()
  for (const match of text.matchAll(GROWTH_CONTENT_MERGE_FIELD_RE)) {
    const key = match[1]?.trim().toLowerCase()
    if (key) keys.add(key)
  }
  return [...keys]
}

export function isBlockedContentVariable(key: string): boolean {
  const normalized = key.trim().toLowerCase()
  if (GROWTH_CONTENT_BLOCKED_VARIABLE_KEYS.has(normalized)) return true
  return GROWTH_CONTENT_BLOCKED_VARIABLE_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function validateContentMergeFields(input: {
  text: string
  allowedKeys: Set<string>
}): {
  valid: boolean
  usedVariables: string[]
  blockedVariables: string[]
  unknownVariables: string[]
} {
  const usedVariables = extractContentMergeFields(input.text)
  const blockedVariables = usedVariables.filter(isBlockedContentVariable)
  const unknownVariables = usedVariables.filter(
    (key) => !isBlockedContentVariable(key) && !input.allowedKeys.has(key),
  )
  return {
    valid: blockedVariables.length === 0 && unknownVariables.length === 0,
    usedVariables,
    blockedVariables,
    unknownVariables,
  }
}

export function requiresComplianceFooter(text: string): boolean {
  const fields = extractContentMergeFields(text)
  return fields.includes("unsubscribe.link")
}

export function assertNoBlockedVariables(text: string): void {
  const blocked = extractContentMergeFields(text).filter(isBlockedContentVariable)
  if (blocked.length > 0) {
    throw new Error(`blocked_merge_fields:${blocked.join(",")}`)
  }
}
