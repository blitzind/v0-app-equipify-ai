import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { getPlatformAdminAllowlistMeta, isPlatformAdminEmail } from "@/lib/platform-admin"
import { isGrowthQaAccelerationEnabled } from "@/lib/growth/sequence-enrollment/qa-acceleration-config"
import {
  classifyGrowthEngineBearerAuthError,
  getGrowthEngineBearerTokenMetadata,
} from "@/lib/growth/growth-engine-platform-user-resolution"
import {
  createServerSupabaseClient,
  createSupabaseClientWithAccessToken,
  getBearerAccessToken,
} from "@/lib/supabase/server"

/** Global kill switch for Growth Engine platform routes. Default off. */
export function isGrowthEngineEnabledEnv(): boolean {
  return process.env.GROWTH_ENGINE_ENABLED?.trim() === "true"
}

/** Org UUID used for ai_usage_logs when running internal Growth Engine research. */
export function getGrowthEngineAiOrgId(): string | null {
  const id = process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()
  if (!id) return null
  const parsed = z.string().uuid().safeParse(id)
  return parsed.success ? parsed.data : null
}

export function logGrowthEngine(event: string, details: Record<string, unknown>): void {
  console.info(
    JSON.stringify({
      source: "growth-engine",
      event,
      ts: new Date().toISOString(),
      ...details,
    }),
  )
}

export type GrowthEnginePlatformAccess =
  | {
      ok: true
      admin: SupabaseClient
      userId: string
      userEmail: string
    }
  | { ok: false; response: NextResponse }

export type GrowthEnginePlatformUserResolution = {
  bearer_token_present: boolean
  bearer_resolution_attempted: boolean
  bearer_resolution_error_code: string | null
  bearer_resolution_error_message_safe: string | null
  bearer_token_length: number
  bearer_token_segment_count: number
  bearer_user_resolved: boolean
  cookie_user_resolved: boolean
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
  const bearerClientResult = await bearerClient.auth.getUser()
  const bearerUser = mapSupabaseUser(bearerClientResult.data.user)
  if (bearerUser) {
    return {
      bearer_user_resolved: true,
      bearer_user: bearerUser,
      bearer_resolution_error_code: null,
      bearer_resolution_error_message_safe: null,
    }
  }

  let errorInfo = classifyGrowthEngineBearerAuthError(bearerClientResult.error)
  if (!bearerClientResult.error && bearerClientResult.data.user?.id && !bearerUser) {
    errorInfo = {
      code: "email_missing",
      message_safe: "Supabase user resolved without email",
    }
  }

  const cookieBearerResult = await cookieClient.auth.getUser(bearer)
  const cookieBearerUser = mapSupabaseUser(cookieBearerResult.data.user)
  if (cookieBearerUser) {
    return {
      bearer_user_resolved: true,
      bearer_user: cookieBearerUser,
      bearer_resolution_error_code: null,
      bearer_resolution_error_message_safe: null,
    }
  }

  if (cookieBearerResult.error) {
    errorInfo = classifyGrowthEngineBearerAuthError(cookieBearerResult.error)
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
    data: { user: cookieSessionUser },
  } = await cookieClient.auth.getUser()
  const cookieUser = mapSupabaseUser(cookieSessionUser)
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
    resolved_user: cookieUser ?? bearerUser,
  }
}

async function resolveGrowthEnginePlatformUser(request?: Request): Promise<{
  userId: string
  userEmail: string
} | null> {
  const resolution = await resolveGrowthEnginePlatformUserResolution(request)
  return resolution.resolved_user
}

export async function requireGrowthEnginePlatformAccess(
  request?: Request,
): Promise<GrowthEnginePlatformAccess> {
  if (!isGrowthEngineEnabledEnv()) {
    logGrowthEngine("access_denied", { reason: "feature_disabled" })
    return {
      ok: false,
      response: NextResponse.json(
        { error: "feature_disabled", message: "Growth Engine is not enabled for this deployment." },
        { status: 403 },
      ),
    }
  }

  const resolvedUser = await resolveGrowthEnginePlatformUser(request)

  if (!resolvedUser || !isPlatformAdminEmail(resolvedUser.userEmail)) {
    logGrowthEngine("access_denied", {
      reason: "forbidden",
      auth_mode: request && getBearerAccessToken(request) ? "bearer" : "cookie",
      email: resolvedUser?.userEmail ?? null,
    })
    return {
      ok: false,
      response: NextResponse.json(
        { error: "forbidden", message: "Platform admin access required." },
        { status: 403 },
      ),
    }
  }

  try {
    return {
      ok: true,
      admin: createServiceRoleSupabaseClient(),
      userId: resolvedUser.userId,
      userEmail: resolvedUser.userEmail,
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    const missingServiceRoleKey = detail.includes("SUPABASE_SERVICE_ROLE_KEY")
    logGrowthEngine("access_denied", { reason: "server_config", detail })
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "server_config",
          message: missingServiceRoleKey
            ? "SUPABASE_SERVICE_ROLE_KEY is not configured. Growth Engine requires the service role client for growth schema access."
            : "Server is not configured for platform admin operations.",
        },
        { status: 503 },
      ),
    }
  }
}

export async function requireGrowthQaAccelerationAccess(): Promise<GrowthEnginePlatformAccess> {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access

  if (!isGrowthQaAccelerationEnabled()) {
    logGrowthEngine("qa_acceleration_denied", { reason: "disabled_in_environment" })
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "qa_acceleration_disabled",
          message: "QA acceleration controls are disabled in this environment.",
        },
        { status: 403 },
      ),
    }
  }

  return access
}
