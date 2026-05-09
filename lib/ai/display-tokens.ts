/**
 * Customer-facing "AI tokens" — abstract units tied to provider usage without exposing USD.
 * Roughly aligned with typical token accounting (prompt + completion).
 */
export const AI_DISPLAY_TOKENS_PER_USD = 25_000

export function usdToIncludedAiTokens(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0
  return Math.max(0, Math.round(usd * AI_DISPLAY_TOKENS_PER_USD))
}

export function centsToIncludedAiTokens(cents: number): number {
  if (!Number.isFinite(cents) || cents <= 0) return 0
  return usdToIncludedAiTokens(cents / 100)
}
