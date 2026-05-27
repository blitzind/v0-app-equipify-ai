import { createHash } from "node:crypto"

const BLOCKED_KEYS = new Set([
  "authorization",
  "api_key",
  "apikey",
  "access_token",
  "refresh_token",
  "secret",
  "password",
  "smtp_password",
  "signing_secret",
  "token",
  "bearer",
  "x-api-key",
  "x-amz-sns-message",
])

const SENSITIVE_SUBSTRINGS = [
  "password",
  "secret",
  "token",
  "authorization",
  "api_key",
  "apikey",
  "credential",
  "private_key",
]

const MAX_STRING_LENGTH = 500
const MAX_DEPTH = 6
const MAX_ARRAY_ITEMS = 20
const MAX_OBJECT_KEYS = 30

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  if (BLOCKED_KEYS.has(lower)) return true
  return SENSITIVE_SUBSTRINGS.some((part) => lower.includes(part))
}

function sanitizeString(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= MAX_STRING_LENGTH) return trimmed
  return `${trimmed.slice(0, MAX_STRING_LENGTH)}…`
}

function looksLikeEmailBody(key: string, value: string): boolean {
  const lower = key.toLowerCase()
  if (lower.includes("body") || lower.includes("html") || lower.includes("content")) {
    return value.length > 200 || value.includes("<html") || value.includes("<body")
  }
  return false
}

function looksLikeHeaders(key: string): boolean {
  const lower = key.toLowerCase()
  return lower === "headers" || lower.endsWith("_headers") || lower.includes("raw_headers")
}

export function sanitizeProviderWebhookPayload(
  input: unknown,
  depth = 0,
): Record<string, unknown> {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return {}
  }

  const source = input as Record<string, unknown>
  const sanitized: Record<string, unknown> = {}
  let keyCount = 0

  for (const [key, value] of Object.entries(source)) {
    if (keyCount >= MAX_OBJECT_KEYS) break
    if (isSensitiveKey(key) || looksLikeHeaders(key)) continue

    if (typeof value === "string") {
      if (looksLikeEmailBody(key, value)) {
        sanitized[key] = "[redacted_body]"
      } else {
        sanitized[key] = sanitizeString(value)
      }
      keyCount++
      continue
    }

    if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value
      keyCount++
      continue
    }

    if (Array.isArray(value) && depth < MAX_DEPTH) {
      sanitized[key] = value.slice(0, MAX_ARRAY_ITEMS).map((item) => {
        if (typeof item === "string") return sanitizeString(item)
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return sanitizeProviderWebhookPayload(item, depth + 1)
        }
        return item
      })
      keyCount++
      continue
    }

    if (value && typeof value === "object" && depth < MAX_DEPTH) {
      sanitized[key] = sanitizeProviderWebhookPayload(value, depth + 1)
      keyCount++
    }
  }

  return sanitized
}

export function hashWebhookPayload(input: {
  providerFamily: string
  rawBody: string
  sanitizedPayload: Record<string, unknown>
}): string {
  const canonical = JSON.stringify({
    provider_family: input.providerFamily,
    body: input.rawBody,
    sanitized: input.sanitizedPayload,
  })
  return createHash("sha256").update(canonical).digest("hex")
}

export function hashWebhookSigningSecret(secret: string): string {
  return createHash("sha256").update(secret.trim()).digest("hex")
}
