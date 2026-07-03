/** GE-AIOS-BUSINESS-PROFILE-1B — Website context caps (client-safe). */

export const BUSINESS_PROFILE_WEBSITE_CONTEXT_MAX_CHARS = 1500 as const

export function sanitizeBusinessProfileWebsiteText(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

export function capBusinessProfileWebsiteContext(
  text: string,
  maxChars: number = BUSINESS_PROFILE_WEBSITE_CONTEXT_MAX_CHARS,
): string {
  const normalized = sanitizeBusinessProfileWebsiteText(text)
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, Math.max(0, maxChars - 1))}…`
}
