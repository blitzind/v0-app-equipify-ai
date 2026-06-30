/** GE-DATAMOON-1B — Sanitize Datamoon provider metadata before persistence. Client-safe. */

const SENSITIVE_KEY_PATTERN = /api[_-]?key|authorization|token|secret|password/i
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const PHONE_PATTERN = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g

function redactString(value: string): string {
  return value
    .replace(SENSITIVE_KEY_PATTERN, "[REDACTED]")
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .replace(PHONE_PATTERN, "[REDACTED_PHONE]")
}

export function sanitizeDatamoonProviderMetadata(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[TRUNCATED]"
  if (value == null) return value
  if (typeof value === "string") return redactString(value)
  if (typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeDatamoonProviderMetadata(item, depth + 1))
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = "[REDACTED]"
        continue
      }
      output[key] = sanitizeDatamoonProviderMetadata(nested, depth + 1)
    }
    return output
  }
  return String(value)
}

export function sanitizeDatamoonProviderRecord(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeDatamoonProviderMetadata(value)
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) return {}
  return sanitized as Record<string, unknown>
}
