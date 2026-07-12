/**
 * Request-local Growth Engine cookie-session auth.
 * Never store inflight auth promises at module scope — concurrent HTTP requests
 * in the same Node isolate must not share authentication results.
 */

import {
  classifyGrowthEngineBearerAuthError,
  sanitizeGrowthEngineAuthErrorMessage,
} from "@/lib/growth/growth-engine-platform-user-resolution"

export type GrowthEngineCookieAuthUser = {
  id: string
  email?: string | null
}

export type GrowthEngineCookieGetUserResult = {
  data: { user: GrowthEngineCookieAuthUser | null }
  error: { code?: string | null; message?: string | null; name?: string | null } | null
}

export type GrowthEngineCookieSessionAuthSnapshot = {
  cookieSessionResult: GrowthEngineCookieGetUserResult | null
  cookieUser: { userId: string; userEmail: string } | null
  cookie_auth_timeout: boolean
  cookie_auth_error_code: string | null
  cookie_auth_error_message_safe: string | null
}

export function mapGrowthEngineCookieAuthUser(
  user: GrowthEngineCookieAuthUser | null | undefined,
): { userId: string; userEmail: string } | null {
  if (!user?.id) return null
  const email = typeof user.email === "string" ? user.email.trim() : ""
  if (!email) return null
  return { userId: user.id, userEmail: email }
}

/**
 * Authenticate using only the getUser bound to the current request's cookie client.
 * Each invocation must call getUser — never reuse another request's promise.
 */
export async function resolveCookieSessionAuthSnapshot(input: {
  getUser: () => Promise<GrowthEngineCookieGetUserResult>
  raceAuthOperation: <T>(operation: Promise<T>) => Promise<T | null>
}): Promise<GrowthEngineCookieSessionAuthSnapshot> {
  const cookieSessionResult = await input.raceAuthOperation(input.getUser())

  if (cookieSessionResult === null) {
    return {
      cookieSessionResult: null,
      cookieUser: null,
      cookie_auth_timeout: true,
      cookie_auth_error_code: "auth_timeout",
      cookie_auth_error_message_safe: "Growth Engine cookie auth resolution timed out.",
    }
  }

  const cookieUser = mapGrowthEngineCookieAuthUser(cookieSessionResult.data.user)
  if (cookieUser) {
    return {
      cookieSessionResult,
      cookieUser,
      cookie_auth_timeout: false,
      cookie_auth_error_code: null,
      cookie_auth_error_message_safe: null,
    }
  }

  if (cookieSessionResult.error) {
    const errorInfo = classifyGrowthEngineBearerAuthError(cookieSessionResult.error)
    return {
      cookieSessionResult,
      cookieUser: null,
      cookie_auth_timeout: false,
      cookie_auth_error_code: errorInfo.code,
      cookie_auth_error_message_safe: errorInfo.message_safe,
    }
  }

  if (cookieSessionResult.data.user?.id && !cookieUser) {
    return {
      cookieSessionResult,
      cookieUser: null,
      cookie_auth_timeout: false,
      cookie_auth_error_code: "email_missing",
      cookie_auth_error_message_safe: sanitizeGrowthEngineAuthErrorMessage(
        "Supabase user resolved without email",
      ),
    }
  }

  return {
    cookieSessionResult,
    cookieUser: null,
    cookie_auth_timeout: false,
    cookie_auth_error_code: null,
    cookie_auth_error_message_safe: null,
  }
}
