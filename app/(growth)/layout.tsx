import { redirect } from "next/navigation"
import { AdminSessionSeed } from "@/components/admin-session-seed"
import { AdminWorkspaceShell } from "@/components/admin-workspace-shell"
import { loadPlatformAdminIdentity } from "@/lib/load-platform-admin-identity"

/** Growth workspace route group — platform-admin gate matches existing Growth API access. */
export default async function GrowthRouteGroupLayout({ children }: { children: React.ReactNode }) {
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
