/** Canonical Growth recipient email format validation. Client-safe. */

/** Certified recipient verification regex (matches email-verification-service). */
export const GROWTH_EMAIL_FORMAT_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i

export function isValidGrowthEmailFormat(email: string): boolean {
  const trimmed = email.trim()
  if (!trimmed) return false
  return GROWTH_EMAIL_FORMAT_RE.test(trimmed)
}
