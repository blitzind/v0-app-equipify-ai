"use client"

import React, { useState } from "react"
import { AppSidebar, SidebarContext } from "@/components/app-sidebar"
import { PageShell } from "@/components/page-shell"
import { WorkOrderProvider } from "@/lib/work-order-store"
import { MaintenanceProvider } from "@/lib/maintenance-store"
import { TenantProvider } from "@/lib/tenant-store"
import { EquipmentProvider } from "@/lib/equipment-store"
import { CustomerProvider } from "@/lib/customer-store"
import { QuoteInvoiceProvider } from "@/lib/quote-invoice-store"
import { EquipmentTypeProvider } from "@/lib/equipment-type-store"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <TenantProvider>
      <WorkOrderProvider>
        <MaintenanceProvider>
          <EquipmentProvider>
            <CustomerProvider>
              <QuoteInvoiceProvider>
                <EquipmentTypeProvider>
                  <SidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>
                    <div className="flex h-dvh overflow-hidden bg-background">
                      <AppSidebar />
                      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                        <PageShell>{children}</PageShell>
                      </div>
                    </div>
                  </SidebarContext.Provider>
                </EquipmentTypeProvider>
              </QuoteInvoiceProvider>
            </CustomerProvider>
          </EquipmentProvider>
        </MaintenanceProvider>
      </WorkOrderProvider>
    </TenantProvider>
  )
}
