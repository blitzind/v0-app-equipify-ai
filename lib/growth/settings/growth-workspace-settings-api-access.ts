import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getGrowthEngineAiOrgId,
  isGrowthEngineEnabledEnv,
  logGrowthEngine,
  resolveGrowthEnginePlatformUserResolution,
} from "@/lib/growth/access"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"

export const GROWTH_WORKSPACE_SETTINGS_API_ACCESS_QA_MARKER =
  "growth-workspace-settings-api-access-8h-v1" as const

export type GrowthWorkspaceSettingsApiAccess =
  | {
      ok: true
      admin: SupabaseClient
      userId: string
      userEmail: string
      isPlatformAdmin: boolean
      organizationId: string | null
    }
  | { ok: false; response: NextResponse }

async function isActiveGrowthWorkspaceOrgMember(
  admin: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  if (error) throw new Error(error.message)
  return Boolean(data)
}

/**
 * Workspace settings API access — platform admin OR active member of the configured Growth org.
 *
 * TODO(org-rbac): Replace membership probe with explicit permission grants per workspace.
 */
export async function requireGrowthWorkspaceSettingsAccess(
  request?: Request,
): Promise<GrowthWorkspaceSettingsApiAccess> {
  try {
    const resolution = await resolveGrowthEnginePlatformUserResolution(request)
    const resolvedUser = resolution.resolved_user
    if (!resolvedUser) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: "unauthenticated", message: "Sign in to manage Growth workspace settings." },
          { status: 401 },
        ),
      }
    }

    const isPlatformAdmin = isPlatformAdminEmail(resolvedUser.userEmail)
    const organizationId = getGrowthEngineAiOrgId()

    if (isPlatformAdmin) {
      try {
        const admin = createServiceRoleSupabaseClient()
        return {
          ok: true,
          admin,
          userId: resolvedUser.userId,
          userEmail: resolvedUser.userEmail,
          isPlatformAdmin: true,
          organizationId,
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        logGrowthEngine("workspace_settings_access_denied", { reason: "server_config", detail })
        return {
          ok: false,
          response: NextResponse.json(
            {
              ok: false,
              error: "server_config",
              message: "Server is not configured for Growth workspace settings operations.",
            },
            { status: 503 },
          ),
        }
      }
    }

    if (!isGrowthEngineEnabledEnv()) {
      logGrowthEngine("workspace_settings_access_denied", { reason: "feature_disabled" })
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: "feature_disabled", message: "Growth Engine is not enabled for this deployment." },
          { status: 403 },
        ),
      }
    }

    let allowed = false
    if (organizationId) {
      try {
        const admin = createServiceRoleSupabaseClient()
        allowed = await isActiveGrowthWorkspaceOrgMember(admin, resolvedUser.userId, organizationId)
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        logGrowthEngine("workspace_settings_access_denied", { reason: "membership_probe_failed", detail })
        allowed = false
      }
    }

    if (!allowed) {
      logGrowthEngine("workspace_settings_access_denied", {
        reason: "forbidden",
        email: resolvedUser.userEmail,
        organization_configured: Boolean(organizationId),
      })
      return {
        ok: false,
        response: NextResponse.json(
          {
            ok: false,
            error: "forbidden",
            message: "Growth workspace settings access required.",
          },
          { status: 403 },
        ),
      }
    }

    try {
      const admin = createServiceRoleSupabaseClient()
      return {
        ok: true,
        admin,
        userId: resolvedUser.userId,
        userEmail: resolvedUser.userEmail,
        isPlatformAdmin: false,
        organizationId,
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      logGrowthEngine("workspace_settings_access_denied", { reason: "server_config", detail })
      return {
        ok: false,
        response: NextResponse.json(
          {
            ok: false,
            error: "server_config",
            message: "Server is not configured for Growth workspace settings operations.",
          },
          { status: 503 },
        ),
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    logGrowthEngine("workspace_settings_access_denied", { reason: "unexpected", detail })
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "forbidden",
          message: "Growth workspace settings access required.",
        },
        { status: 403 },
      ),
    }
  }
}

/** Communications settings surfaces (mailboxes, DNS, warmup, pools, reputation). */
export async function requireGrowthCommunicationsSettingsAccess(
  request?: Request,
): Promise<GrowthWorkspaceSettingsApiAccess> {
  return requireGrowthWorkspaceSettingsAccess(request)
}

export function growthWorkspaceSettingsJsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}
