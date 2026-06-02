import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isGrowthEngineEnabledEnv, logGrowthEngine } from "@/lib/growth/access"
import { createServerSupabaseClient } from "@/lib/supabase/server"
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
  sessionId?: string | null
  requireSessionOwner?: boolean
  /** When true, trust caller-side Zod validation (answer route) and skip format re-check. */
  skipSessionIdFormatValidation?: boolean
  diagnostics?: VoiceOperatorRouteDiagnostics
  sessionIdDiagnostics?: VoiceOperatorRouteSessionIdDiagnostics
}

function jsonResponse(error: string, message: string, status: number): VoiceOperatorRouteContext {
  return {
    ok: false,
    response: NextResponse.json(
      {
        ok: false,
        error,
        message,
        qaMarker: VOICE_OPERATIONS_QA_MARKER,
      },
      { status },
    ),
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
  if (!isGrowthEngineEnabledEnv()) {
    logGrowthEngine("operator_access_denied", { reason: "feature_disabled" })
    return jsonResponse("feature_disabled", "Growth Engine is not enabled for this deployment.", 403)
  }

  const organizationId = resolveVoiceInfrastructureOrganizationId()
  if (!organizationId) {
    return jsonResponse("org_not_configured", "Set GROWTH_ENGINE_AI_ORG_ID to scope voice operations.", 400)
  }

  const authStartedAt = Date.now()
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  options.diagnostics?.onAuthComplete?.(Date.now() - authStartedAt)

  if (!user?.id) {
    logGrowthEngine("operator_access_denied", { reason: "unauthorized" })
    return jsonResponse("unauthorized", "Sign in required.", 401)
  }

  let admin: SupabaseClient
  try {
    admin = createServiceRoleSupabaseClient()
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    logGrowthEngine("operator_access_denied", { reason: "server_config", detail })
    return jsonResponse("server_config", "Server is not configured for voice operations.", 503)
  }

  const membershipStartedAt = Date.now()
  const { data: membership, error: membershipError } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()
  options.diagnostics?.onMembershipComplete?.(Date.now() - membershipStartedAt)

  if (membershipError) {
    logGrowthEngine("operator_access_denied", {
      reason: "membership_lookup_failed",
      organizationId,
      operatorUserId: user.id,
      membershipFound: false,
      detail: membershipError.message,
    })
    return jsonResponse("membership_lookup_failed", "Could not verify organization membership.", 503)
  }

  if (!membership) {
    logGrowthEngine("operator_access_denied", {
      reason: "not_org_member",
      organizationId,
      operatorUserId: user.id,
      membershipFound: false,
    })
    return jsonResponse("forbidden", "Organization membership required.", 403)
  }

  logGrowthEngine("operator_membership_verified", {
    organizationId,
    operatorUserId: user.id,
    membershipFound: true,
  })

  const rawSessionId = options.sessionId ?? null
  let sessionId: string | null = null
  let session: OperatorSessionRow | null = null

  if (rawSessionId?.trim()) {
    const operatorRoute =
      options.sessionIdDiagnostics?.route ?? "requireVoiceOperatorRouteContext"
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
        userId: user.id,
        detail: sessionError.message,
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
      return jsonResponse("not_found", "Call session not found.", 404)
    }

    session = sessionRow as OperatorSessionRow

    if (options.requireSessionOwner && session.owner_user_id !== user.id) {
      logGrowthEngine("operator_access_denied", {
        reason: session.owner_user_id ? "session_not_owned" : "session_unassigned",
        organizationId,
        sessionId,
        userId: user.id,
        ownerUserId: session.owner_user_id,
        status: session.status,
      })
      return jsonResponse("forbidden", "Call session operator access required.", 403)
    }
  } else if (options.requireSessionOwner) {
    logVoiceOperatorSessionIdAudit({
      route: options.sessionIdDiagnostics?.route ?? "requireVoiceOperatorRouteContext",
      branch: "invalid_id_session_id_required",
      sessionId: rawSessionId,
      sessionIdSource: options.sessionIdDiagnostics?.sessionIdSource ?? "operator_route_options",
      organizationId,
      httpStatus: 400,
      errorCode: "invalid_id",
      message: "Session id is required.",
    })
    return jsonResponse("invalid_id", "Session id is required.", 400)
  }

  return {
    ok: true,
    admin,
    organizationId,
    userId: user.id,
    userEmail: user.email ?? null,
    session,
  }
}
