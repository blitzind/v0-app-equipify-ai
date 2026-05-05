import { redirect } from "next/navigation"
import { loadPlatformAdminIdentity } from "@/lib/load-platform-admin-identity"
import { AdminLayoutClient } from "./admin-layout-client"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await loadPlatformAdminIdentity()
  if (!identity) {
    redirect("/")
  }

  return (
    <AdminLayoutClient initialSessionIdentity={identity}>
      <div className="min-h-screen bg-background text-foreground">{children}</div>
    </AdminLayoutClient>
  )
}
