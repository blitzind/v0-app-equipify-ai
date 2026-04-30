"use client"

import React, { useState } from "react"
import { AppSidebar, SidebarContext } from "@/components/app-sidebar"
import { PageShell } from "@/components/page-shell"
import { WorkOrderProvider } from "@/lib/work-order-store"
import { MaintenanceProvider } from "@/lib/maintenance-store"
import { TenantProvider } from "@/lib/tenant-store"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <TenantProvider>
      <WorkOrderProvider>
        <MaintenanceProvider>
          <SidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>
            <div className="flex h-dvh overflow-hidden bg-background">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <PageShell>{children}</PageShell>
              </div>
            </div>
          </SidebarContext.Provider>
        </MaintenanceProvider>
      </WorkOrderProvider>
    </TenantProvider>
  )
}
