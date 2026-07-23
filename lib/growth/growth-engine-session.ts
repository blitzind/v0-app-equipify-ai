import "server-only"

import {
  isPlatformGrowthEngineEnabledEnv,
  readPlatformGrowthEngineAiOrgIdFromEnv,
} from "@fuzor/configuration"
import { logGrowthEngine as logGrowthEngineEvent } from "@/lib/growth/growth-engine-log"
import { resolveCookieSessionAuthSnapshot } from "@/lib/growth/growth-engine-cookie-session-auth"
import {
  classifyGrowthEngineBearerAuthError,
  getGrowthEngineBearerTokenMetadata,
} from "@/lib/growth/growth-engine-platform-user-resolution"
import {
  createServerSupabaseClient,
  createSupabaseClientWithAccessToken,
  getBearerAccessToken,
} from "@/lib/supabase/server"
import { raceMiddlewareAuthOperation } from "@/lib/supabase/middleware-timeout"

/** Global kill switch for Growth Engine platform routes. Default off. */
export function isGrowthEngineEnabledEnv(): boolean {
  return isPlatformGrowthEngineEnabledEnv()
}

/** Org UUID used for ai_usage_logs when running internal Growth Engine research. */
export function getGrowthEngineAiOrgId(): string | null {
  return readPlatformGrowthEngineAiOrgIdFromEnv()
}

export function logGrowthEngine(event: string, details: Record<string, unknown>): void {
  logGrowthEngineEvent(event, details)
}

export type GrowthEnginePlatformUserResolution = {
  bearer_token_present: boolean
  bearer_resolution_attempted: boolean
  bearer_resolution_error_code: string | null
  bearer_resolution_error_message_safe: string | null
  bearer_token_length: number
  bearer_token_segment_count: number
  bearer_user_resolved: boolean
  cookie_user_resolved: boolean
  cookie_auth_timeout: boolean
  cookie_auth_error_code: string | null
  cookie_auth_error_message_safe: string | null
  resolved_user: { userId: string; userEmail: string } | null
}

function mapSupabaseUser(user: { id: string; email?: string | null } | null | undefined): {
  userId: string
  userEmail: string
} | null {
  if (!user?.id) return null
  const email = typeof user.email === "string" ? user.email.trim() : ""
  if (!email) return null
  return { userId: user.id, userEmail: email }
}

/**
 * Authenticate with the current request's cookie client only.
 * Never reuse auth promises across HTTP requests (module-scoped inflight is forbidden).
 */
async function resolveCookieSessionUser(
  cookieClient: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  return resolveCookieSessionAuthSnapshot({
    getUser: async () => {
      const result = await cookieClient.auth.getUser()
      return {
        data: { user: result.data.user ? { id: result.data.user.id, email: result.data.user.email } : null },
        error: result.error
          ? {
              code: result.error.code,
              message: result.error.message,
              name: result.error.name,
            }
          : null,
      }
    },
    raceAuthOperation: raceMiddlewareAuthOperation,
  })
}

async function resolveGrowthEngineBearerUser(
  bearer: string,
  cookieClient: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<{
  bearer_user_resolved: boolean
  bearer_user: { userId: string; userEmail: string } | null
  bearer_resolution_error_code: string | null
  bearer_resolution_error_message_safe: string | null
}> {
  const bearerClient = createSupabaseClientWithAccessToken(bearer)
  const bearerClientResult = await raceMiddlewareAuthOperation(bearerClient.auth.getUser())
  const bearerUser = mapSupabaseUser(bearerClientResult?.data.user)
  if (bearerUser) {
    return {
      bearer_user_resolved: true,
      bearer_user: bearerUser,
      bearer_resolution_error_code: null,
      bearer_resolution_error_message_safe: null,
    }
  }

  let errorInfo = classifyGrowthEngineBearerAuthError(bearerClientResult?.error)
  if (!bearerClientResult?.error && bearerClientResult?.data.user?.id && !bearerUser) {
    errorInfo = {
      code: "email_missing",
      message_safe: "Supabase user resolved without email",
    }
  }

  const cookieBearerResult = await raceMiddlewareAuthOperation(cookieClient.auth.getUser(bearer))
  const cookieBearerUser = mapSupabaseUser(cookieBearerResult?.data.user)
  if (cookieBearerUser) {
    return {
      bearer_user_resolved: true,
      bearer_user: cookieBearerUser,
      bearer_resolution_error_code: null,
      bearer_resolution_error_message_safe: null,
    }
  }

  if (cookieBearerResult?.error) {
    errorInfo = classifyGrowthEngineBearerAuthError(cookieBearerResult.error)
  }

  if (!bearerClientResult && !cookieBearerResult) {
    errorInfo = {
      code: "auth_timeout",
      message_safe: "Growth Engine auth resolution timed out.",
    }
  }

  return {
    bearer_user_resolved: false,
    bearer_user: null,
    bearer_resolution_error_code: errorInfo.code,
    bearer_resolution_error_message_safe: errorInfo.message_safe,
  }
}

export async function resolveGrowthEnginePlatformUserResolution(
  request?: Request,
): Promise<GrowthEnginePlatformUserResolution> {
  const cookieClient = await createServerSupabaseClient()
  const bearer = request ? getBearerAccessToken(request) : null
  const tokenMeta = getGrowthEngineBearerTokenMetadata(bearer)

  const {
    cookieUser,
    cookie_auth_timeout,
    cookie_auth_error_code,
    cookie_auth_error_message_safe,
  } = await resolveCookieSessionUser(cookieClient)
  const cookie_user_resolved = Boolean(cookieUser)

  let bearer_user_resolved = false
  let bearerUser: { userId: string; userEmail: string } | null = null
  let bearer_resolution_attempted = false
  let bearer_resolution_error_code: string | null = null
  let bearer_resolution_error_message_safe: string | null = null

  if (bearer && !cookieUser) {
    bearer_resolution_attempted = true
    const bearerResolution = await resolveGrowthEngineBearerUser(bearer, cookieClient)
    bearer_user_resolved = bearerResolution.bearer_user_resolved
    bearerUser = bearerResolution.bearer_user
    bearer_resolution_error_code = bearerResolution.bearer_resolution_error_code
    bearer_resolution_error_message_safe = bearerResolution.bearer_resolution_error_message_safe
  }

  return {
    bearer_token_present: Boolean(bearer),
    bearer_resolution_attempted,
    bearer_resolution_error_code,
    bearer_resolution_error_message_safe,
    bearer_token_length: tokenMeta.bearer_token_length,
    bearer_token_segment_count: tokenMeta.bearer_token_segment_count,
    bearer_user_resolved,
    cookie_user_resolved,
    cookie_auth_timeout,
    cookie_auth_error_code,
    cookie_auth_error_message_safe,
    resolved_user: cookieUser ?? bearerUser,
  }
}

export async function resolveGrowthEnginePlatformUser(request?: Request): Promise<{
  userId: string
  userEmail: string
} | null> {
  const resolution = await resolveGrowthEnginePlatformUserResolution(request)
  return resolution.resolved_user
}
