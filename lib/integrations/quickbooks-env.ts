export type QuickBooksApiEnvironment = "production" | "sandbox"

/** Derive accounting API target for UI labels (never exposes secrets). */
export function getQuickBooksApiEnvironment(): QuickBooksApiEnvironment {
  const base = (process.env.QUICKBOOKS_API_BASE_URL ?? "").trim().toLowerCase()
  if (base.includes("sandbox")) return "sandbox"
  return "production"
}

export function quickBooksOAuthConfigured(): boolean {
  return Boolean(
    process.env.QUICKBOOKS_CLIENT_ID?.trim() &&
      process.env.QUICKBOOKS_CLIENT_SECRET?.trim() &&
      process.env.QUICKBOOKS_REDIRECT_URI?.trim(),
  )
}

export function getQuickBooksRedirectUri(): string {
  return process.env.QUICKBOOKS_REDIRECT_URI?.trim() ?? ""
}

export function getQuickBooksClientId(): string {
  return process.env.QUICKBOOKS_CLIENT_ID?.trim() ?? ""
}

/** Production default; use sandbox host for dev if needed. */
export function getQuickBooksApiBaseUrl(): string {
  return process.env.QUICKBOOKS_API_BASE_URL?.trim() || "https://quickbooks.api.intuit.com"
}
