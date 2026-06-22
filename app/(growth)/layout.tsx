import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { AdminSessionSeed } from "@/components/admin-session-seed"
import { AdminWorkspaceShell } from "@/components/admin-workspace-shell"
import { isGrowthCommunicationsSettingsPath } from "@/lib/growth/navigation/growth-communications-settings-navigation"
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
  const communicationsSettingsRoute = isGrowthCommunicationsSettingsPath(pathname)

  let identity: SessionIdentity | null = null

  if (communicationsSettingsRoute) {
    const access = await resolveGrowthWorkspaceSettingsPageAccess()
    if (!access.ok) {
      redirect(access.reason === "unauthenticated" ? "/login" : "/")
    }
    identity = access.identity
  } else {
    identity = await loadPlatformAdminIdentity()
    if (!identity) {
      redirect("/")
    }
  }

  return (
    <AdminWorkspaceShell>
      <AdminSessionSeed identity={identity} />
      {children}
    </AdminWorkspaceShell>
  )
}
