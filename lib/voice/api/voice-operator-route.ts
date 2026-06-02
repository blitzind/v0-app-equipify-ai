import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isGrowthEngineEnabledEnv, logGrowthEngine } from "@/lib/growth/access"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { resolveVoiceInfrastructureOrganizationId } from "@/lib/voice/repository/voice-repository"
import { VOICE_OPERATIONS_QA_MARKER } from "@/lib/voice/types"

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i

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

export type VoiceOperatorRouteContextOptions = {
  sessionId?: string | null
  requireSessionOwner?: boolean
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

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  const { data: membership, error: membershipError } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (membershipError) {
    logGrowthEngine("operator_access_denied", {
      reason: "membership_lookup_failed",
      organizationId,
      userId: user.id,
      detail: membershipError.message,
    })
    return jsonResponse("membership_lookup_failed", "Could not verify organization membership.", 503)
  }

  if (!membership) {
    logGrowthEngine("operator_access_denied", {
      reason: "not_org_member",
      organizationId,
      userId: user.id,
    })
    return jsonResponse("forbidden", "Organization membership required.", 403)
  }

  const sessionId = options.sessionId?.trim() || null
  let session: OperatorSessionRow | null = null

  if (sessionId) {
    if (!UUID_RE.test(sessionId)) {
      return jsonResponse("invalid_id", "Session id is invalid.", 400)
    }

    const { data: sessionRow, error: sessionError } = await admin
      .schema("growth")
      .from("native_call_workspace_sessions")
      .select("id, organization_id, owner_user_id, status")
      .eq("id", sessionId)
      .eq("organization_id", organizationId)
      .maybeSingle()

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
