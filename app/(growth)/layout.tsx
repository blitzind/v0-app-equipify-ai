import { redirect } from "next/navigation"
import { AdminSessionSeed } from "@/components/admin-session-seed"
import { AdminWorkspaceShell } from "@/components/admin-workspace-shell"
import { loadPlatformAdminIdentity } from "@/lib/load-platform-admin-identity"
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

  const identity = await loadPlatformAdminIdentity()
  if (!identity) {
    redirect("/")
  }

  return (
    <AdminWorkspaceShell>
      <AdminSessionSeed identity={identity} />
      {children}
    </AdminWorkspaceShell>
  )
}
