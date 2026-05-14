let lastSignature = ""
let lastAt = 0

/**
 * Deduplicates SPA page_view in React Strict Mode (dev double-invoke) and rapid remounts.
 */
export function shouldSendMarketingPageView(signature: string, windowMs = 450): boolean {
  const now = Date.now()
  if (signature === lastSignature && now - lastAt < windowMs) return false
  lastSignature = signature
  lastAt = now
  return true
}
