import "server-only"

import { notFound } from "next/navigation"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { resolveHasGrowthWorkspaceAccess } from "@/lib/settings/workspace-settings-visibility"

/**
 * Server gate for restricted Workspace Settings route groups (Growth Engine,
 * Growth Operator, Data & Administration). Unauthorized users receive notFound().
 */
export async function requireWorkspaceSettingsPlatformAdminAccess(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isPlatformAdmin = isPlatformAdminEmail(user?.email)
  if (!resolveHasGrowthWorkspaceAccess({ isPlatformAdmin })) {
    notFound()
  }
}
