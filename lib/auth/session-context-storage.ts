import { EQUIPIFY_SUPPORT_SESSION_ORG_CACHE_KEY } from "@/lib/support-session-storage"

/** Active workspace pin — must be cleared on logout and auth user switch. */
export const ACTIVE_ORG_STORAGE_KEY = "equipify_active_organization_id"

/** Tab-scoped auth user pin — detects account switches without clearing org on refresh. */
const SESSION_AUTH_USER_KEY = "equipify_session_auth_user_id"

function readSessionAuthUserId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage.getItem(SESSION_AUTH_USER_KEY)
  } catch {
    return null
  }
}

function writeSessionAuthUserId(userId: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (userId) window.sessionStorage.setItem(SESSION_AUTH_USER_KEY, userId)
    else window.sessionStorage.removeItem(SESSION_AUTH_USER_KEY)
  } catch {
    /* ignore */
  }
}

/** Remove org/support pins that must not carry across authenticated users. */
export function clearUserScopedClientStorage(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY)
    window.localStorage.removeItem(EQUIPIFY_SUPPORT_SESSION_ORG_CACHE_KEY)
  } catch {
    /* private mode / blocked storage */
  }
}

/**
 * Clear org/support pins when the authenticated Supabase user changed
 * (login, logout, or account switch). Preserves org pin on same-user refresh.
 */
export function clearUserScopedClientStorageIfAuthUserChanged(nextUserId: string): boolean {
  const previousUserId = readSessionAuthUserId()
  if (previousUserId === nextUserId) return false
  clearUserScopedClientStorage()
  writeSessionAuthUserId(nextUserId)
  return true
}

/** Clear tab auth pin and org/support local pins (logout). */
export function clearAuthSessionClientStorage(): void {
  clearUserScopedClientStorage()
  writeSessionAuthUserId(null)
}
