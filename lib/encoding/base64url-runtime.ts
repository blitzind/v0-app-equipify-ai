/** Runtime-safe URL-safe base64 (base64url) — Node, Edge, and browser compatible. Client-safe. */

export const GROWTH_BASE64URL_RUNTIME_FIX_QA_MARKER = "growth-base64url-runtime-fix-v1" as const

/** Client-safe diagnostics — no secrets, console warnings only. */
export function logBase64UrlRuntimeIssue(
  code: string,
  context: Record<string, string | null | undefined> = {},
): void {
  if (typeof console === "undefined" || typeof console.warn !== "function") return
  console.warn(`[${GROWTH_BASE64URL_RUNTIME_FIX_QA_MARKER}]`, code, context)
}

/** Convert URL-safe base64 to standard base64 with required padding restored. */
export function normalizeBase64UrlToStandard(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    throw new Error("invalid_base64url_characters")
  }

  let base64 = trimmed.replace(/-/g, "+").replace(/_/g, "/")
  const mod = base64.length % 4
  if (mod === 2) base64 += "=="
  else if (mod === 3) base64 += "="
  else if (mod === 1) {
    throw new Error("invalid_base64url_length")
  }
  return base64
}

/** Encode UTF-8 text to URL-safe base64 without relying on unsupported Buffer encodings. */
export function encodeUtf8ToBase64Url(value: string): string {
  if (typeof value !== "string") return ""
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(value, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
    }

    const bytes = new TextEncoder().encode(value)
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  } catch (error) {
    logBase64UrlRuntimeIssue("encode_failed", {
      message: error instanceof Error ? error.message : "unknown",
    })
    return ""
  }
}

/** Decode URL-safe base64 to UTF-8 using standard base64 after normalization. */
export function decodeBase64UrlToUtf8(value: string): string {
  const standard = normalizeBase64UrlToStandard(value)
  if (!standard) return ""

  if (typeof Buffer !== "undefined") {
    return Buffer.from(standard, "base64").toString("utf8")
  }

  return decodeURIComponent(
    Array.from(atob(standard), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
  )
}

/** Decode with invalid-input protection — returns null instead of throwing. */
export function safeDecodeBase64UrlToUtf8(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : ""
  if (!trimmed) return null
  try {
    return decodeBase64UrlToUtf8(trimmed)
  } catch (error) {
    logBase64UrlRuntimeIssue("decode_invalid_state", {
      length: String(trimmed.length),
      message: error instanceof Error ? error.message : "unknown",
    })
    return null
  }
}
