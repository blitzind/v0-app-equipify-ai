import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { displayNameFromProfile } from "@/lib/user-display"
import { loadGrowthSessionIdentity } from "@/lib/growth/rbac/growth-access-resolution"
import type { SessionIdentity } from "@/lib/session-identity"

/**
 * Loads the current user if they are listed in EQUIPIFY_PLATFORM_ADMIN_EMAILS.
 * Used to gate `/admin` layouts (middleware enforces session only).
 */
export async function loadPlatformAdminIdentity(): Promise<SessionIdentity | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return null
  }

  const email = user.email.trim()
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle()

  const row = profile as { full_name: string | null } | null

  return {
    authUserId: user.id,
    email,
    displayName: displayNameFromProfile(row?.full_name, email),
    platformAdmin: true,
    platformRoleLabel: "Platform Admin",
    growthRole: "platform_admin",
  }
}

/** Loads Growth workspace identity for any authorized Growth role. */
export async function loadGrowthWorkspaceIdentity(): Promise<SessionIdentity | null> {
  return loadGrowthSessionIdentity()
}
