import { AppSidebar } from "@/components/app-sidebar"
import { PageShell } from "@/components/page-shell"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <PageShell>{children}</PageShell>
      </div>
    </div>
  )
}
