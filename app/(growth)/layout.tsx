import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { AdminSessionSeed } from "@/components/admin-session-seed"
import { AdminWorkspaceShell } from "@/components/admin-workspace-shell"
import { isGrowthWorkspaceSettingsPathname } from "@/lib/growth/navigation/growth-workspace-settings-paths"
import { resolveGrowthWorkspaceSettingsPageAccess } from "@/lib/growth/settings/growth-workspace-settings-page-access"
import { loadPlatformAdminIdentity } from "@/lib/load-platform-admin-identity"
import type { SessionIdentity } from "@/lib/session-identity"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/** Growth workspace route group — auth enforced here (middleware bypasses /growth/*). */
export default async function GrowthRouteGroupLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const headersList = await headers()
  const pathname = headersList.get("x-growth-pathname") ?? ""

  // Platform admin always passes — workspace settings RBAC is a secondary gate for non-admins.
  let identity: SessionIdentity | null = await loadPlatformAdminIdentity()

  if (!identity && isGrowthWorkspaceSettingsPathname(pathname)) {
    try {
      const access = await resolveGrowthWorkspaceSettingsPageAccess()
      if (!access.ok) {
        redirect(access.reason === "unauthenticated" ? "/login" : "/")
      }
      identity = access.identity
    } catch {
      redirect("/")
    }
  } else if (!identity) {
    redirect("/")
  }

  return (
    <AdminWorkspaceShell>
      <AdminSessionSeed identity={identity} />
      {children}
    </AdminWorkspaceShell>
  )
}
