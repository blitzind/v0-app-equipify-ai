/** Safe JSON parsing for Prospect Search discovery — client-safe, never throws on empty/invalid bodies. */

export const GROWTH_SAFE_PROVIDER_PARSING_QA_MARKER = "growth-safe-provider-parsing-v1" as const

export const GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER =
  "growth-discovery-runtime-hardening-v1" as const

export const GROWTH_RUNTIME_REGRESSION_FIX_QA_MARKER = "growth-runtime-regression-fix-v1" as const

export type SafeJsonParseErrorKind =
  | "empty_body"
  | "invalid_json"
  | "html_response"
  | "non_json_content_type"
  | "network_error"

export type SafeJsonParseResult<T> =
  | {
      ok: true
      data: T
      status: number
      content_type: string | null
      raw_text_length: number
    }
  | {
      ok: false
      status: number
      content_type: string | null
      error: string
      error_kind: SafeJsonParseErrorKind
      raw_preview: string | null
    }

function trimPreview(text: string, max = 160): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max)}…`
}

function looksLikeHtml(text: string): boolean {
  const sample = text.trimStart().slice(0, 256).toLowerCase()
  return sample.startsWith("<!doctype") || sample.startsWith("<html") || sample.startsWith("<")
}

export function safeParseJsonText<T = unknown>(
  rawText: string,
  status: number,
  contentType: string | null = null,
): SafeJsonParseResult<T> {
  const trimmed = rawText.trim()
  if (!trimmed) {
    return {
      ok: false,
      status,
      content_type: contentType,
      error: "Response body was empty — provider or API returned no JSON payload.",
      error_kind: "empty_body",
      raw_preview: null,
    }
  }

  if (looksLikeHtml(trimmed)) {
    return {
      ok: false,
      status,
      content_type: contentType,
      error: "Response looked like HTML instead of JSON — provider or gateway may be unavailable.",
      error_kind: "html_response",
      raw_preview: trimPreview(trimmed),
    }
  }

  try {
    return {
      ok: true,
      data: JSON.parse(trimmed) as T,
      status,
      content_type: contentType,
      raw_text_length: trimmed.length,
    }
  } catch {
    return {
      ok: false,
      status,
      content_type: contentType,
      error: "Malformed JSON response — could not parse provider/API payload.",
      error_kind: "invalid_json",
      raw_preview: trimPreview(trimmed),
    }
  }
}

export async function safeParseJsonResponse<T = unknown>(
  response: Response,
): Promise<SafeJsonParseResult<T>> {
  const contentType = response.headers.get("content-type")
  let rawText = ""
  try {
    rawText = await response.text()
  } catch {
    return {
      ok: false,
      status: response.status,
      content_type: contentType,
      error: "Failed to read response body.",
      error_kind: "network_error",
      raw_preview: null,
    }
  }

  const parsed = safeParseJsonText<T>(rawText, response.status, contentType)
  if (
    !parsed.ok &&
    parsed.error_kind === "invalid_json" &&
    contentType &&
    !contentType.includes("json") &&
    !contentType.includes("text/plain")
  ) {
    return {
      ...parsed,
      error_kind: "non_json_content_type",
      error: `Unexpected content type (${contentType}) — expected JSON.`,
    }
  }
  return parsed
}

export async function safeFetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<SafeJsonParseResult<T>> {
  try {
    const response = await fetch(url, init)
    return safeParseJsonResponse<T>(response)
  } catch (err) {
    return {
      ok: false,
      status: 0,
      content_type: null,
      error: err instanceof Error ? err.message : "Network request failed.",
      error_kind: "network_error",
      raw_preview: null,
    }
  }
}

export type SafeDiscoveryProviderResponse<T> = {
  ok: boolean
  status: number
  data: T | null
  error: string | null
  error_kind: SafeJsonParseErrorKind | null
  content_type: string | null
}

export async function safeDiscoveryProviderResponse<T = unknown>(
  response: Response,
): Promise<SafeDiscoveryProviderResponse<T>> {
  const parsed = await safeParseJsonResponse<T>(response)
  if (parsed.ok) {
    return {
      ok: true,
      status: parsed.status,
      data: parsed.data,
      error: null,
      error_kind: null,
      content_type: parsed.content_type,
    }
  }
  return {
    ok: false,
    status: parsed.status,
    data: null,
    error: parsed.error,
    error_kind: parsed.error_kind,
    content_type: parsed.content_type,
  }
}

export function formatSafeJsonParseError(result: Extract<SafeJsonParseResult<unknown>, { ok: false }>): string {
  if (result.status >= 500) {
    return `${result.error} (HTTP ${result.status})`
  }
  if (result.status === 401 || result.status === 403) {
    return `${result.error} (HTTP ${result.status} — check platform access.)`
  }
  return result.error
}
