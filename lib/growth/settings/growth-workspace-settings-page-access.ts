import "server-only"

import { resolveGrowthEnginePlatformUserResolution } from "@/lib/growth/growth-engine-session"
import { GROWTH_ROLE_LABELS } from "@/lib/growth/rbac/growth-role-types"
import { resolveGrowthRoleForUser } from "@/lib/growth/rbac/growth-access-resolution"
import { displayNameFromProfile } from "@/lib/user-display"
import type { SessionIdentity } from "@/lib/session-identity"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const GROWTH_WORKSPACE_SETTINGS_PAGE_ACCESS_QA_MARKER =
  "growth-workspace-settings-page-access-rbac-1a-v1" as const

export type GrowthWorkspaceSettingsPageAccessResult =
  | {
      ok: true
      identity: SessionIdentity
      isPlatformAdmin: boolean
      organizationId: string | null
    }
  | { ok: false; reason: "unauthenticated" | "feature_disabled" | "forbidden" }

async function buildWorkspaceSettingsIdentity(
  userId: string,
  userEmail: string,
  platformAdmin: boolean,
  growthRole: SessionIdentity["growthRole"],
): Promise<SessionIdentity> {
  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle()

  return {
    authUserId: userId,
    email: userEmail,
    displayName: displayNameFromProfile(
      (profile as { full_name?: string | null } | null)?.full_name,
      userEmail,
    ),
    platformAdmin,
    platformRoleLabel: growthRole ? GROWTH_ROLE_LABELS[growthRole] : null,
    growthRole,
  }
}

/** Server gate for Growth workspace settings pages — uses centralized Growth RBAC. */
export async function resolveGrowthWorkspaceSettingsPageAccess(
  request?: Request,
): Promise<GrowthWorkspaceSettingsPageAccessResult> {
  try {
    const resolution = await resolveGrowthEnginePlatformUserResolution(request)
    const resolvedUser = resolution.resolved_user
    if (!resolvedUser) {
      return { ok: false, reason: "unauthenticated" }
    }

    const accessContext = await resolveGrowthRoleForUser(resolvedUser)
    if (!accessContext) {
      return { ok: false, reason: "forbidden" }
    }

    const identity = await buildWorkspaceSettingsIdentity(
      resolvedUser.userId,
      resolvedUser.userEmail,
      accessContext.isPlatformAdmin,
      accessContext.role,
    )

    return {
      ok: true,
      identity,
      isPlatformAdmin: accessContext.isPlatformAdmin,
      organizationId: accessContext.organizationId,
    }
  } catch {
    return { ok: false, reason: "forbidden" }
  }
}
