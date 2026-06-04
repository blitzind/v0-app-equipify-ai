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

/** ZeroBounce v2 validate — see https://www.zerobounce.net/docs/email-validation-api-quickstart/v2-validate-emails */
const ZEROBOUNCE_VALIDATE_BASE_URL =
  process.env.GROWTH_ZEROBOUNCE_VALIDATE_BASE_URL?.trim() ||
  process.env.ZEROBOUNCE_VALIDATE_BASE_URL?.trim() ||
  "https://api.zerobounce.net/v2/validate"

export function resolveZeroBounceValidateUrl(email: string, apiKey: string): string {
  const url = new URL(ZEROBOUNCE_VALIDATE_BASE_URL)
  url.searchParams.set("api_key", apiKey)
  url.searchParams.set("email", email)
  return url.toString()
}
