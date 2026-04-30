import { AppSidebar } from "@/components/app-sidebar"
import { PageShell } from "@/components/page-shell"
import { WorkOrderProvider } from "@/lib/work-order-store"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkOrderProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <PageShell>{children}</PageShell>
        </div>
      </div>
    </WorkOrderProvider>
  )
}
