/** Growth Engine platform user resolution helpers — client-safe metadata + error sanitization. */

export type GrowthEngineBearerTokenMetadata = {
  bearer_token_length: number
  bearer_token_segment_count: number
}

export function getGrowthEngineBearerTokenMetadata(token: string | null | undefined): GrowthEngineBearerTokenMetadata {
  const raw = typeof token === "string" ? token.trim() : ""
  if (!raw) {
    return { bearer_token_length: 0, bearer_token_segment_count: 0 }
  }
  return {
    bearer_token_length: raw.length,
    bearer_token_segment_count: raw.split(".").length,
  }
}

export function sanitizeGrowthEngineAuthErrorMessage(message: string | null | undefined): string | null {
  if (!message) return null
  const trimmed = message.trim().slice(0, 240)
  if (!trimmed) return null
  // Never echo token-like material in diagnostics.
  if (/eyJ[a-zA-Z0-9_-]{10,}/.test(trimmed)) return "supabase_auth_error"
  return trimmed
}

export function classifyGrowthEngineBearerAuthError(error: {
  code?: string | null
  message?: string | null
  name?: string | null
} | null): { code: string; message_safe: string | null } {
  if (!error) {
    return { code: "auth_error", message_safe: null }
  }
  const code = (error.code ?? error.name ?? "auth_error").trim() || "auth_error"
  return {
    code,
    message_safe: sanitizeGrowthEngineAuthErrorMessage(error.message),
  }
}
