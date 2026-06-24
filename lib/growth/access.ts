import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isGrowthQaAccelerationEnabled } from "@/lib/growth/sequence-enrollment/qa-acceleration-config"
import {
  isGrowthEngineEnabledEnv,
  logGrowthEngine,
  resolveGrowthEnginePlatformUserResolution,
} from "@/lib/growth/growth-engine-session"
import type { GrowthAccessOptions } from "@/lib/growth/rbac/growth-access-resolution"
import { requireGrowthAccess } from "@/lib/growth/rbac/growth-access-resolution"

export type GrowthEnginePlatformAccess =
  | {
      ok: true
      admin: SupabaseClient
      userId: string
      userEmail: string
    }
  | { ok: false; response: NextResponse }

export type { GrowthEnginePlatformUserResolution } from "@/lib/growth/growth-engine-session"

export {
  getGrowthEngineAiOrgId,
  isGrowthEngineEnabledEnv,
  logGrowthEngine,
  resolveGrowthEnginePlatformUser,
  resolveGrowthEnginePlatformUserResolution,
} from "@/lib/growth/growth-engine-session"

/**
 * Growth Engine API access — resolves minimum role from request path unless overridden.
 * Platform admins retain full access via the centralized RBAC resolver.
 */
export async function requireGrowthEnginePlatformAccess(
  request?: Request,
  options?: GrowthAccessOptions,
): Promise<GrowthEnginePlatformAccess> {
  const access = await requireGrowthAccess(request, options)
  if (!access.ok) return access
  return {
    ok: true,
    admin: access.admin,
    userId: access.userId,
    userEmail: access.userEmail,
  }
}

export async function requireGrowthQaAccelerationAccess(
  request?: Request,
): Promise<GrowthEnginePlatformAccess> {
  const access = await requireGrowthEnginePlatformAccess(request, { minimumRole: "platform_admin" })
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

export async function requireGrowthOperatorAccess(request?: Request): Promise<GrowthEnginePlatformAccess> {
  return requireGrowthEnginePlatformAccess(request, { minimumRole: "growth_operator" })
}

export async function requireGrowthManagerAccess(request?: Request): Promise<GrowthEnginePlatformAccess> {
  return requireGrowthEnginePlatformAccess(request, { minimumRole: "growth_manager" })
}

export async function requireGrowthPlatformAdminAccess(request?: Request): Promise<GrowthEnginePlatformAccess> {
  return requireGrowthEnginePlatformAccess(request, { minimumRole: "platform_admin" })
}
