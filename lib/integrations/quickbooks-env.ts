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
