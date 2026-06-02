import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isGrowthEngineEnabledEnv, logGrowthEngine } from "@/lib/growth/access"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import {
  createServerSupabaseClient,
  createSupabaseClientWithAccessToken,
  getBearerAccessToken,
} from "@/lib/supabase/server"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import {
  describeNativeSessionIdValidation,
  LEGACY_OPERATOR_UUID_RE,
  normalizeNativeSessionId,
} from "@/lib/voice/api/native-session-id-validation"
import {
  logSessionIdValidationFailure,
  logVoiceOperatorSessionIdAudit,
} from "@/lib/voice/api/session-id-validation-diagnostics"
import { resolveVoiceInfrastructureOrganizationId } from "@/lib/voice/repository/voice-repository"
import { VOICE_OPERATIONS_QA_MARKER } from "@/lib/voice/types"

/** @deprecated Use normalizeNativeSessionId / nativeSessionIdSchema instead. */
export const UUID_RE = LEGACY_OPERATOR_UUID_RE

type OperatorSessionRow = {
  id: string
  organization_id: string
  owner_user_id: string | null
  status: string | null
}

export type VoiceOperatorRouteContext =
  | {
      ok: true
      admin: SupabaseClient
      organizationId: string
      userId: string
      userEmail: string | null
      session: OperatorSessionRow | null
    }
  | { ok: false; response: NextResponse }

export type VoiceOperatorRouteDiagnostics = {
  onAuthComplete?: (durationMs: number) => void
  onMembershipComplete?: (durationMs: number) => void
}

export type VoiceOperatorRouteSessionIdDiagnostics = {
  route: string
  sessionIdSource: string
  activeVoiceCallId?: string | null
  nativeSessionId?: string | null
  realtimeSessionId?: string | null
}

export type VoiceOperatorRouteContextOptions = {
  request?: Request
  sessionId?: string | null
  requireSessionOwner?: boolean
  /** When true, trust caller-side Zod validation (answer route) and skip format re-check. */
  skipSessionIdFormatValidation?: boolean
  diagnostics?: VoiceOperatorRouteDiagnostics
  sessionIdDiagnostics?: VoiceOperatorRouteSessionIdDiagnostics
}

export type VoiceOperatorAuthStage =
  | "no_session_cookie"
  | "session_invalid"
  | "not_org_member"
  | "org_not_configured"
  | "session_not_owned"
  | "workspace_session_missing"
  | "platform_admin_granted"
  | "org_member_granted"

function jsonResponse(
  error: string,
  message: string,
  status: number,
  authStage?: VoiceOperatorAuthStage,
): VoiceOperatorRouteContext {
  return {
    ok: false,
    response: NextResponse.json(
      {
        ok: false,
        error,
        message,
        authStage: authStage ?? null,
        qaMarker: VOICE_OPERATIONS_QA_MARKER,
      },
      { status },
    ),
  }
}

function hasSupabaseAuthCookie(cookieEntries: Array<{ name: string }>): boolean {
  return cookieEntries.some(
    ({ name }) => name.includes("-auth-token") || name.startsWith("sb-") || name.includes("supabase-auth-token"),
  )
}

type ResolvedVoiceOperatorAuth =
  | {
      ok: true
      userId: string
      userEmail: string | null
      authSource: "cookie" | "bearer"
      hadAuthCookie: boolean
      bearerPresent: boolean
    }
  | {
      ok: false
      authStage: "no_session_cookie" | "session_invalid"
      authFailureReason: string
      hadAuthCookie: boolean
      bearerPresent: boolean
    }

function logVoiceOperatorAuthResolution(input: {
  route: string
  outcome: "granted" | "denied"
  authSource: "cookie" | "bearer" | "none"
  hadAuthCookie: boolean
  bearerPresent: boolean
  sessionUserId?: string | null
  platformAdminMatched?: boolean
  authFailureReason?: string | null
  bearerFallback?: string | null
}): void {
  logVoiceInfrastructure("voice_operator_auth_resolution", {
    route: input.route,
    outcome: input.outcome,
    authSource: input.authSource,
    hadAuthCookie: input.hadAuthCookie,
    bearerPresent: input.bearerPresent,
    sessionUserId: input.sessionUserId ?? null,
    platformAdminMatched: input.platformAdminMatched ?? false,
    authFailureReason: input.authFailureReason ?? null,
    bearerFallback: input.bearerFallback ?? null,
  })
}

async function resolveVoiceOperatorAuth(input: {
  request?: Request
  route?: string
}): Promise<ResolvedVoiceOperatorAuth> {
  const route = input.route ?? "requireVoiceOperatorRouteContext"
  const cookieStore = await cookies()
  const cookieEntries = cookieStore.getAll()
  const hadAuthCookie = hasSupabaseAuthCookie(cookieEntries)
  const bearer = input.request ? getBearerAccessToken(input.request) : null
  const bearerPresent = Boolean(bearer)
  const supabase = await createServerSupabaseClient()

  const {
    data: { user: cookieUser },
    error: cookieError,
  } = await supabase.auth.getUser()

  if (cookieUser?.id) {
    logVoiceOperatorAuthResolution({
      route,
      outcome: "granted",
      authSource: "cookie",
      hadAuthCookie,
      bearerPresent,
      sessionUserId: cookieUser.id,
      platformAdminMatched: Boolean(cookieUser.email && isPlatformAdminEmail(cookieUser.email)),
      bearerFallback: bearerPresent ? "ignored_stale_bearer_cookie_authoritative" : null,
    })
    return {
      ok: true,
      userId: cookieUser.id,
      userEmail: cookieUser.email ?? null,
      authSource: "cookie",
      hadAuthCookie,
      bearerPresent,
    }
  }

  if (bearer) {
    const bearerClient = createSupabaseClientWithAccessToken(bearer)
    const { data, error } = await bearerClient.auth.getUser()
    if (data.user?.id) {
      logVoiceOperatorAuthResolution({
        route,
        outcome: "granted",
        authSource: "bearer",
        hadAuthCookie,
        bearerPresent,
        sessionUserId: data.user.id,
        platformAdminMatched: Boolean(data.user.email && isPlatformAdminEmail(data.user.email)),
        bearerFallback: "cookie_missing_or_invalid_used_bearer",
      })
      return {
        ok: true,
        userId: data.user.id,
        userEmail: data.user.email ?? null,
        authSource: "bearer",
        hadAuthCookie,
        bearerPresent,
      }
    }

    const authFailureReason = hadAuthCookie
      ? "bearer_invalid_and_cookie_invalid"
      : "bearer_invalid"
    logVoiceOperatorAuthResolution({
      route,
      outcome: "denied",
      authSource: "bearer",
      hadAuthCookie,
      bearerPresent,
      authFailureReason,
      bearerFallback: cookieError?.message ?? null,
    })
    logGrowthEngine("operator_access_denied", {
      reason: authFailureReason,
      route,
      authSource: "bearer",
      hadAuthCookie,
      bearerPresent: true,
      cookieError: cookieError?.message ?? null,
      bearerError: error?.message ?? null,
    })
    return {
      ok: false,
      authStage: hadAuthCookie || bearerPresent ? "session_invalid" : "no_session_cookie",
      authFailureReason,
      hadAuthCookie,
      bearerPresent,
    }
  }

  const authFailureReason = hadAuthCookie ? "cookie_invalid" : "no_session_cookie"
  logVoiceOperatorAuthResolution({
    route,
    outcome: "denied",
    authSource: "cookie",
    hadAuthCookie,
    bearerPresent,
    authFailureReason,
    bearerFallback: cookieError?.message ?? null,
  })
  logGrowthEngine("operator_access_denied", {
    reason: authFailureReason,
    route,
    authSource: "cookie",
    hadAuthCookie,
    bearerPresent: false,
    cookieError: cookieError?.message ?? null,
  })
  return {
    ok: false,
    authStage: hadAuthCookie ? "session_invalid" : "no_session_cookie",
    authFailureReason,
    hadAuthCookie,
    bearerPresent,
  }
}

function logInvalidNativeSessionIdReturn(input: {
  route: string
  branch: string
  sessionIdSource: string
  rawSessionId: string | null
  organizationId?: string | null
}): void {
  const validation = describeNativeSessionIdValidation(input.rawSessionId)
  logSessionIdValidationFailure({
    route: input.route,
    branch: input.branch,
    message: "Session id is invalid.",
    sessionId: input.rawSessionId,
    sessionIdSource: input.sessionIdSource,
    sessionIdPassedUuidValidation: validation.zodUuidPass,
  })
  logVoiceOperatorSessionIdAudit({
    route: input.route,
    branch: input.branch,
    sessionId: input.rawSessionId,
    sessionIdSource: input.sessionIdSource,
    organizationId: input.organizationId ?? null,
    httpStatus: 400,
    errorCode: "invalid_id",
    message: "Session id is invalid.",
    ...validation,
  })
}

export async function requireVoiceOperatorRouteContext(
  options: VoiceOperatorRouteContextOptions = {},
): Promise<VoiceOperatorRouteContext> {
  const operatorRoute =
    options.sessionIdDiagnostics?.route ?? "requireVoiceOperatorRouteContext"

  if (!isGrowthEngineEnabledEnv()) {
    logGrowthEngine("operator_access_denied", { reason: "feature_disabled", route: operatorRoute })
    return jsonResponse("feature_disabled", "Growth Engine is not enabled for this deployment.", 403)
  }

  const organizationId = resolveVoiceInfrastructureOrganizationId()
  if (!organizationId) {
    logGrowthEngine("operator_access_denied", { reason: "org_not_configured", route: operatorRoute })
    return jsonResponse(
      "org_not_configured",
      "Set GROWTH_ENGINE_AI_ORG_ID to scope voice operations.",
      400,
      "org_not_configured",
    )
  }

  const authStartedAt = Date.now()
  const auth = await resolveVoiceOperatorAuth({ request: options.request, route: operatorRoute })
  options.diagnostics?.onAuthComplete?.(Date.now() - authStartedAt)

  if (!auth.ok) {
    if (auth.authStage === "no_session_cookie") {
      return jsonResponse(
        "unauthorized",
        "Your sign-in session expired. Refresh this page to restore browser calling.",
        401,
        "no_session_cookie",
      )
    }
    return jsonResponse(
      "unauthorized",
      "Could not verify your sign-in session. Refresh this page and try again.",
      401,
      "session_invalid",
    )
  }

  const isPlatformAdmin = Boolean(auth.userEmail && isPlatformAdminEmail(auth.userEmail))

  let admin: SupabaseClient
  try {
    admin = createServiceRoleSupabaseClient()
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    logGrowthEngine("operator_access_denied", { reason: "server_config", detail, route: operatorRoute })
    return jsonResponse("server_config", "Server is not configured for voice operations.", 503)
  }

  if (isPlatformAdmin) {
    logGrowthEngine("operator_platform_admin_granted", {
      organizationId,
      operatorUserId: auth.userId,
      route: operatorRoute,
      authSource: auth.authSource,
      hadAuthCookie: auth.hadAuthCookie,
      bearerPresent: auth.bearerPresent,
    })
  } else {
    const membershipStartedAt = Date.now()
    const { data: membership, error: membershipError } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("user_id", auth.userId)
      .eq("status", "active")
      .maybeSingle()
    options.diagnostics?.onMembershipComplete?.(Date.now() - membershipStartedAt)

    if (membershipError) {
      logGrowthEngine("operator_access_denied", {
        reason: "membership_lookup_failed",
        organizationId,
        operatorUserId: auth.userId,
        membershipFound: false,
        detail: membershipError.message,
        route: operatorRoute,
      })
      return jsonResponse("membership_lookup_failed", "Could not verify organization membership.", 503)
    }

    if (!membership) {
      logGrowthEngine("operator_access_denied", {
        reason: "not_org_member",
        organizationId,
        operatorUserId: auth.userId,
        membershipFound: false,
        route: operatorRoute,
        authSource: auth.authSource,
        hadAuthCookie: auth.hadAuthCookie,
      })
      return jsonResponse(
        "forbidden",
        "Growth Engine voice access requires membership in the configured organization.",
        403,
        "not_org_member",
      )
    }

    logGrowthEngine("operator_membership_verified", {
      organizationId,
      operatorUserId: auth.userId,
      membershipFound: true,
      route: operatorRoute,
      authSource: auth.authSource,
    })
  }

  const rawSessionId = options.sessionId ?? null
  let sessionId: string | null = null
  let session: OperatorSessionRow | null = null

  if (rawSessionId?.trim()) {
    const sessionIdSource =
      options.sessionIdDiagnostics?.sessionIdSource ?? "operator_route_options"

    sessionId = options.skipSessionIdFormatValidation
      ? rawSessionId.trim()
      : normalizeNativeSessionId(rawSessionId)

    if (!sessionId) {
      logInvalidNativeSessionIdReturn({
        route: operatorRoute,
        branch: "invalid_id_zod_uuid_failed",
        sessionIdSource,
        rawSessionId,
        organizationId,
      })
      return jsonResponse("invalid_id", "Session id is invalid.", 400)
    }

    logVoiceOperatorSessionIdAudit({
      route: operatorRoute,
      branch: "uuid_validation_passed",
      sessionId: rawSessionId,
      sessionIdSource,
      organizationId,
      ...describeNativeSessionIdValidation(rawSessionId),
    })

    const { data: sessionRow, error: sessionError } = await admin
      .schema("growth")
      .from("native_call_workspace_sessions")
      .select("id, organization_id, owner_user_id, status")
      .eq("id", sessionId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    logVoiceOperatorSessionIdAudit({
      route: operatorRoute,
      branch: sessionError
        ? "db_lookup_error"
        : sessionRow
          ? "db_lookup_found"
          : "db_lookup_not_found",
      sessionId: rawSessionId,
      sessionIdSource,
      organizationId,
      dbLookupFound: sessionRow ? true : sessionRow === null ? false : null,
      dbLookupError: sessionError?.message ?? null,
      normalizedSessionId: sessionId,
    })

    if (sessionError) {
      logGrowthEngine("operator_access_denied", {
        reason: "session_lookup_failed",
        organizationId,
        sessionId,
        userId: auth.userId,
        detail: sessionError.message,
        route: operatorRoute,
      })
      return jsonResponse("session_lookup_failed", "Could not verify call session access.", 503)
    }

    if (!sessionRow) {
      logVoiceOperatorSessionIdAudit({
        route: operatorRoute,
        branch: "not_found_return",
        sessionId: rawSessionId,
        sessionIdSource,
        organizationId,
        dbLookupFound: false,
        normalizedSessionId: sessionId,
        httpStatus: 404,
        errorCode: "not_found",
        message: "Call session not found.",
      })
      return jsonResponse("not_found", "Call session not found.", 404, "workspace_session_missing")
    }

    session = sessionRow as OperatorSessionRow

    if (options.requireSessionOwner && session.owner_user_id !== auth.userId && !isPlatformAdmin) {
      logGrowthEngine("operator_access_denied", {
        reason: session.owner_user_id ? "session_not_owned" : "session_unassigned",
        organizationId,
        sessionId,
        userId: auth.userId,
        ownerUserId: session.owner_user_id,
        status: session.status,
        route: operatorRoute,
      })
      return jsonResponse("forbidden", "Call session operator access required.", 403, "session_not_owned")
    }
  } else if (options.requireSessionOwner) {
    logVoiceOperatorSessionIdAudit({
      route: operatorRoute,
      branch: "invalid_id_session_id_required",
      sessionId: rawSessionId,
      sessionIdSource: options.sessionIdDiagnostics?.sessionIdSource ?? "operator_route_options",
      organizationId,
      httpStatus: 400,
      errorCode: "invalid_id",
      message: "Session id is required.",
    })
    return jsonResponse("invalid_id", "Session id is required.", 400, "workspace_session_missing")
  }

  return {
    ok: true,
    admin,
    organizationId,
    userId: auth.userId,
    userEmail: auth.userEmail,
    session,
  }
}

/** Auth-only operator context for token/register routes — no workspace session lookup or call reconciliation. */
export async function requireVoiceBrowserLightweightOperatorContext(input: {
  request?: Request
  route: string
  diagnostics?: VoiceOperatorRouteDiagnostics
}): Promise<VoiceOperatorRouteContext> {
  return requireVoiceOperatorRouteContext({
    request: input.request,
    sessionId: null,
    requireSessionOwner: false,
    diagnostics: input.diagnostics,
    sessionIdDiagnostics: {
      route: input.route,
      sessionIdSource: "lightweight_route",
    },
  })
}
