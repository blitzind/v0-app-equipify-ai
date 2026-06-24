import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { AdminSessionSeed } from "@/components/admin-session-seed"
import { AdminWorkspaceShell } from "@/components/admin-workspace-shell"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { resolveGrowthWorkspacePageAccess } from "@/lib/growth/rbac/growth-access-resolution"
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
  const pathname = headersList.get("x-growth-pathname") ?? GROWTH_WORKSPACE_BASE_PATH

  const access = await resolveGrowthWorkspacePageAccess({ pathname })
  if (!access.ok) {
    redirect(access.reason === "unauthenticated" ? "/login" : "/")
  }

  return (
    <AdminWorkspaceShell>
      <AdminSessionSeed identity={access.identity} />
      {children}
    </AdminWorkspaceShell>
  )
}
