import type { AiProviderId, AiTaskId } from "@/lib/ai/types"

const MAX_SAFE_STRING_LEN = 180
const MAX_SAFE_METADATA_JSON_BYTES = 2048
const MAX_DEBUG_JSON_BYTES = 4096
const MAX_JOB_JSON_BYTES = 4096

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PHONE_RE = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g
const CARD_RE = /\b(?:\d[ -]?){13,19}\b/g
const API_KEY_RE =
  /\b(?:sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z\-_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/g
const SECRET_KV_RE = /\b(api[_-]?key|secret|token|password)\s*[:=]\s*([^\s,;]{6,})/gi
const ADDRESS_RE =
  /\b\d{1,6}\s+[A-Za-z0-9.\- ]{2,}\s(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct)\b/gi

const DISALLOWED_TEXT_KEYS = new Set([
  "prompt",
  "promptText",
  "systemPrompt",
  "userPrompt",
  "rawPrompt",
  "completion",
  "rawOutput",
  "outputText",
  "rawText",
  "pdfText",
  "extractedText",
  "fileContent",
  "fileContents",
  "customerMessage",
  "customerMessages",
  "messageBody",
  "messages",
  "responseJson",
  "response_json",
  "input_json",
  "result_json",
])

const ALLOWED_METADATA_KEYS = new Set([
  "promptId",
  "promptVersion",
  "schemaVersion",
  "task",
  "provider",
  "model",
  "attemptCount",
  "escalationReasons",
  "cacheHit",
  "budgetBlocked",
  "planBlocked",
  "jobId",
  "sourceType",
  "sourceId",
  "estimatedCost",
  "usageLogId",
  "count",
  "threshold",
  "fileMimeType",
  "fileSizeBytes",
  "durationMs",
  "execution_mode",
  "real_cost_usd",
])

/**
 * Dev expectation quick-check:
 * `toSafeAiMetadata({ promptId: "x", userPrompt: "hello", model: "gpt-4o-mini" })`
 * -> `{ promptId: "x", model: "gpt-4o-mini" }`
 */

function byteSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8")
}

function trimString(value: string, maxLen = MAX_SAFE_STRING_LEN): string {
  const compact = value.replace(/\s+/g, " ").trim()
  if (compact.length <= maxLen) return compact
  return `${compact.slice(0, maxLen)}…`
}

export function redactSensitiveText(input: string): string {
  let out = input
  out = out.replace(EMAIL_RE, "[redacted:email]")
  out = out.replace(PHONE_RE, "[redacted:phone]")
  out = out.replace(SSN_RE, "[redacted:ssn]")
  out = out.replace(CARD_RE, "[redacted:card]")
  out = out.replace(API_KEY_RE, "[redacted:key]")
  out = out.replace(SECRET_KV_RE, (_, k: string) => `${k}=[redacted]`)
  out = out.replace(ADDRESS_RE, "[redacted:address]")
  return trimString(out)
}

function safeScalar(value: unknown): string | number | boolean | null {
  if (value == null) return null
  if (typeof value === "boolean") return value
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") return redactSensitiveText(value)
  return null
}

export function toSafeAiMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {}
  const raw = input as Record<string, unknown>
  const out: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(raw)) {
    if (!ALLOWED_METADATA_KEYS.has(k)) continue
    if (DISALLOWED_TEXT_KEYS.has(k)) continue
    if (k === "escalationReasons" && Array.isArray(v)) {
      out[k] = v
        .map((x) => (typeof x === "string" ? redactSensitiveText(x) : null))
        .filter((x): x is string => Boolean(x))
        .slice(0, 8)
      continue
    }
    const scalar = safeScalar(v)
    if (scalar !== null) out[k] = scalar
  }

  if (byteSize(out) > MAX_SAFE_METADATA_JSON_BYTES) {
    const minimal: Record<string, unknown> = {}
    for (const k of ["task", "provider", "model", "promptId", "promptVersion", "schemaVersion", "jobId"]) {
      if (out[k] != null) minimal[k] = out[k]
    }
    return minimal
  }
  return out
}

function sanitizeUnknown(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[redacted:nested]"
  if (value == null) return null
  if (typeof value === "string") return redactSensitiveText(value)
  if (typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeUnknown(v, depth + 1))
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DISALLOWED_TEXT_KEYS.has(k)) {
        out[k] = "[redacted]"
      } else {
        out[k] = sanitizeUnknown(v, depth + 1)
      }
    }
    return out
  }
  return "[redacted]"
}

export function toSafeDebugPayload(input: Record<string, unknown>): Record<string, unknown> {
  const safe = sanitizeUnknown(input) as Record<string, unknown>
  if (byteSize(safe) <= MAX_DEBUG_JSON_BYTES) return safe
  return { note: "debug payload truncated", keys: Object.keys(safe).slice(0, 20) }
}

export function toSafeAiJobPayload(input: Record<string, unknown>): Record<string, unknown> {
  const safe = sanitizeUnknown(input) as Record<string, unknown>
  if (byteSize(safe) <= MAX_JOB_JSON_BYTES) return safe
  return { note: "job payload too large; redacted" }
}

export function buildAiUsageOperationalMetadata(args: {
  task: AiTaskId
  provider: AiProviderId
  model: string
  attemptCount?: number
  escalationReasons?: string[]
  cacheHit?: boolean
  budgetBlocked?: boolean
  planBlocked?: boolean
  durationMs?: number
  promptMeta?: Record<string, unknown>
  extras?: Record<string, unknown>
}): Record<string, unknown> {
  return toSafeAiMetadata({
    task: args.task,
    provider: args.provider,
    model: args.model,
    attemptCount: args.attemptCount,
    escalationReasons: args.escalationReasons,
    cacheHit: args.cacheHit,
    budgetBlocked: args.budgetBlocked,
    planBlocked: args.planBlocked,
    durationMs: args.durationMs,
    ...(args.promptMeta ?? {}),
    ...(args.extras ?? {}),
  })
}

