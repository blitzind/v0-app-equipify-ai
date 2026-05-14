/**
 * Client-only hint written when a server-verified support session is active.
 * Cleared when the server reports no session or when support mode ends.
 * Do not use as a source of truth without confirming `/api/platform/support-session`.
 */
export const EQUIPIFY_SUPPORT_SESSION_ORG_CACHE_KEY = "equipify_support_session_org_id"
