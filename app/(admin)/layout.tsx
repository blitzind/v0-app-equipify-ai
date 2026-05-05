import { redirect } from "next/navigation"
import { AdminWorkspaceShell } from "@/components/admin-workspace-shell"
import { loadPlatformAdminIdentity } from "@/lib/load-platform-admin-identity"
import { AdminLayoutClient } from "./admin-layout-client"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await loadPlatformAdminIdentity()
  if (!identity) {
    redirect("/")
  }

  return (
    <AdminLayoutClient initialSessionIdentity={identity}>
      <AdminWorkspaceShell>{children}</AdminWorkspaceShell>
    </AdminLayoutClient>
  )
}
