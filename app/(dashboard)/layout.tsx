"use client"

import React, { useState } from "react"
import Link from "next/link"
import { AppSidebar, SidebarContext } from "@/components/app-sidebar"
import { PageShell } from "@/components/page-shell"
import { WorkOrderProvider } from "@/lib/work-order-store"
import { MaintenanceProvider } from "@/lib/maintenance-store"
import { TenantProvider } from "@/lib/tenant-store"
import { EquipmentProvider } from "@/lib/equipment-store"
import { CustomerProvider } from "@/lib/customer-store"
import { QuoteInvoiceProvider } from "@/lib/quote-invoice-store"
import { PurchaseOrderProvider } from "@/lib/purchase-order-store"
import { EquipmentTypeProvider } from "@/lib/equipment-type-store"
import { AdminProvider, useAdmin } from "@/lib/admin-store"
import { ShieldAlert, X, ArrowRight } from "lucide-react"

// ─── Impersonation banner ─────────────────────────────────────────────────────

function ImpersonationBanner() {
  const { impersonation, endImpersonation } = useAdmin()
  if (!impersonation.active) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#7c3aed] text-white text-xs font-medium shrink-0">
      <ShieldAlert size={13} className="shrink-0" />
      <span className="flex-1">
        You are viewing{" "}
        <span className="font-bold">{impersonation.accountName}</span>
        {" "}as{" "}
        <span className="font-bold">{impersonation.adminRole}</span>
        {" "}({impersonation.adminName})
      </span>
      <Link
        href="/admin"
        onClick={endImpersonation}
        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 transition-colors whitespace-nowrap"
      >
        Exit session <ArrowRight size={11} />
      </Link>
    </div>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <AdminProvider>
      <TenantProvider>
        <WorkOrderProvider>
          <MaintenanceProvider>
            <EquipmentProvider>
              <CustomerProvider>
                <QuoteInvoiceProvider>
                  <PurchaseOrderProvider>
                  <EquipmentTypeProvider>
                    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>
                      <div className="flex flex-col h-dvh overflow-hidden bg-background">
                        <ImpersonationBanner />
                        <div className="flex flex-1 min-h-0 overflow-hidden">
                          <AppSidebar />
                          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                            <PageShell>{children}</PageShell>
                          </div>
                        </div>
                      </div>
                    </SidebarContext.Provider>
                  </EquipmentTypeProvider>
                  </PurchaseOrderProvider>
                </QuoteInvoiceProvider>
              </CustomerProvider>
            </EquipmentProvider>
          </MaintenanceProvider>
        </WorkOrderProvider>
      </TenantProvider>
    </AdminProvider>
  )
}
