import { redirect } from "next/navigation"
import { AdminSessionSeed } from "@/components/admin-session-seed"
import { AdminWorkspaceShell } from "@/components/admin-workspace-shell"
import { loadPlatformAdminIdentity } from "@/lib/load-platform-admin-identity"
import { AdminLayoutClient } from "./admin-layout-client"

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await loadPlatformAdminIdentity()
  if (!identity) {
    redirect("/")
  }

  return (
    <AdminLayoutClient>
      <AdminWorkspaceShell>
        <AdminSessionSeed identity={identity} />
        {children}
      </AdminWorkspaceShell>
    </AdminLayoutClient>
  )
}
