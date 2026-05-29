/** ZeroBounce email verification configuration. Client-safe. */

export function getZeroBounceApiKey(): string | null {
  return (
    process.env.ZEROBOUNCE_API_KEY?.trim() ||
    process.env.GROWTH_ZEROBOUNCE_API_KEY?.trim() ||
    null
  )
}

export function isZeroBounceConfigured(): boolean {
  return Boolean(getZeroBounceApiKey())
}

export function isEmailVerificationDisabled(): boolean {
  return process.env.GROWTH_EMAIL_VERIFICATION_DISABLE?.trim() === "1"
}

export function isEmailVerificationFixtureEnabled(): boolean {
  const raw = process.env.GROWTH_EMAIL_VERIFICATION_USE_FIXTURE?.trim().toLowerCase()
  if (raw === "1" || raw === "true") return true
  if (raw === "0" || raw === "false") return false
  return process.env.NODE_ENV !== "production" && !isZeroBounceConfigured()
}

export function resolveZeroBounceValidateUrl(email: string, apiKey: string): string {
  const url = new URL("https://api.zb.io/v2/validate")
  url.searchParams.set("api_key", apiKey)
  url.searchParams.set("email", email)
  return url.toString()
}
