import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getGrowthEngineAiOrgId,
  isGrowthEngineEnabledEnv,
  resolveGrowthEnginePlatformUserResolution,
} from "@/lib/growth/access"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { displayNameFromProfile } from "@/lib/user-display"
import type { SessionIdentity } from "@/lib/session-identity"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const GROWTH_WORKSPACE_SETTINGS_PAGE_ACCESS_QA_MARKER =
  "growth-workspace-settings-page-access-8d-v1" as const

export type GrowthWorkspaceSettingsPageAccessResult =
  | {
      ok: true
      identity: SessionIdentity
      isPlatformAdmin: boolean
      organizationId: string | null
    }
  | { ok: false; reason: "unauthenticated" | "feature_disabled" | "forbidden" }

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
 * Server gate for Growth workspace settings pages.
 * Platform admin OR active member of GROWTH_ENGINE_AI_ORG_ID when Growth Engine is enabled.
 *
 * TODO(org-rbac): Replace org membership check with explicit Growth workspace permission grants.
 */
export async function resolveGrowthWorkspaceSettingsPageAccess(
  request?: Request,
): Promise<GrowthWorkspaceSettingsPageAccessResult> {
  if (!isGrowthEngineEnabledEnv()) {
    return { ok: false, reason: "feature_disabled" }
  }

  const resolution = await resolveGrowthEnginePlatformUserResolution(request)
  const resolvedUser = resolution.resolved_user
  if (!resolvedUser) {
    return { ok: false, reason: "unauthenticated" }
  }

  const isPlatformAdmin = isPlatformAdminEmail(resolvedUser.userEmail)
  const organizationId = getGrowthEngineAiOrgId()

  let allowed = isPlatformAdmin
  if (!allowed && organizationId) {
    try {
      const admin = createServiceRoleSupabaseClient()
      allowed = await isActiveGrowthWorkspaceOrgMember(admin, resolvedUser.userId, organizationId)
    } catch {
      allowed = false
    }
  }

  if (!allowed) {
    return { ok: false, reason: "forbidden" }
  }

  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", resolvedUser.userId)
    .maybeSingle()

  const identity: SessionIdentity = {
    authUserId: resolvedUser.userId,
    email: resolvedUser.userEmail,
    displayName: displayNameFromProfile((profile as { full_name?: string | null } | null)?.full_name, resolvedUser.userEmail),
    platformAdmin: isPlatformAdmin,
    platformRoleLabel: isPlatformAdmin ? "Platform Admin" : "Growth Operator",
  }

  return {
    ok: true,
    identity,
    isPlatformAdmin,
    organizationId,
  }
}
