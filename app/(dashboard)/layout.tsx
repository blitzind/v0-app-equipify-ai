import { AppSidebar } from "@/components/app-sidebar"
import { PageShell } from "@/components/page-shell"
import { WorkOrderProvider } from "@/lib/work-order-store"
import { MaintenanceProvider } from "@/lib/maintenance-store"
import { TenantProvider } from "@/lib/tenant-store"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <WorkOrderProvider>
        <MaintenanceProvider>
          <div className="flex h-screen overflow-hidden bg-background">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <PageShell>{children}</PageShell>
            </div>
          </div>
        </MaintenanceProvider>
      </WorkOrderProvider>
    </TenantProvider>
  )
}
