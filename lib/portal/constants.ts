/** HTTP-only cookie storing signed portal session (org + customer scoped). */
export const PORTAL_SESSION_COOKIE = "equipify_portal_session"

/** Default session lifetime (seconds). */
export const PORTAL_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14

/** Access-link lifetime. Tokens are time-limited bearer credentials, not permanent. */
export const PORTAL_ACCESS_LINK_TTL_MS = 7 * 86_400_000

/**
 * One-time redemption. GET of `/portal/login?token=` does not consume the credential;
 * only `POST /api/portal/access/exchange` does. Ordinary email scanners fetch GET and
 * do not run the client exchange, so raising max_uses is unnecessary.
 */
export const PORTAL_ACCESS_LINK_MAX_USES = 1

export const PORTAL_DASHBOARD_PATH = "/portal/dashboard"
