"use client"

import React, { Suspense, useEffect, useState } from "react"
import { AidenChatLauncher } from "@/components/aiden/aiden-chat-launcher"
import { AppSidebar, SidebarContext } from "@/components/app-sidebar"
import { PageShell } from "@/components/page-shell"
import { WorkOrderProvider } from "@/lib/work-order-store"
import { MaintenanceProvider } from "@/lib/maintenance-store"
import { TenantProvider } from "@/lib/tenant-store"
import { ActiveOrganizationProvider } from "@/lib/active-organization-context"
import { OrgPermissionsProvider } from "@/lib/org-permissions-context"
import { BillingAccessProvider } from "@/lib/billing-access-context"
import { BillingWarningBanner } from "@/components/billing-warning-banner"
import { TenantWorkspaceSync } from "@/components/tenant-workspace-sync"
import { OrganizationSwitchOverlay } from "@/components/organization-switch-overlay"
import { EquipmentProvider } from "@/lib/equipment-store"
import { CustomerProvider } from "@/lib/customer-store"
import { QuoteInvoiceProvider } from "@/lib/quote-invoice-store"
import { PurchaseOrderProvider } from "@/lib/purchase-order-store"
import { EquipmentTypeProvider } from "@/lib/equipment-type-store"
import { ArchivedDashboardGate } from "@/components/archived-dashboard-gate"
import { DashboardGrowthSettingsShellInstrumentation } from "@/components/dashboard-growth-settings-shell-instrumentation"
import { DashboardWorkspaceShell } from "@/components/dashboard-workspace-shell"
import { FirstRunWelcomeGate } from "@/components/first-run/first-run-welcome-gate"
import { ScreenshotModeGate } from "@/components/screenshot-mode-gate"
import { useAdmin } from "@/lib/admin-store"
import { ShieldAlert, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"

function debugDashboardShell(details: Record<string, unknown>) {
  if (process.env.NEXT_PUBLIC_DEBUG_NAV !== "true" && process.env.NODE_ENV !== "development") return
  console.info("[equipify:shell]", details)
}

// ─── Impersonation banner ─────────────────────────────────────────────────────

function ImpersonationBanner() {
  const router = useRouter()
  const { impersonation, endImpersonation } = useAdmin()
  if (!impersonation.active) return null

  return (
    <div
      data-screenshot-chrome="hide"
      className="flex flex-wrap items-center gap-3 px-4 py-2 bg-[#7c3aed] text-white text-xs font-medium shrink-0"
    >
      <ShieldAlert size={13} className="shrink-0" />
      <span className="flex-1 min-w-[12rem]">
        <span className="font-semibold">Platform admin support access</span>
        {" — "}viewing{" "}
        <span className="font-bold">{impersonation.accountName}</span>
        {" "}as{" "}
        <span className="font-bold">{impersonation.adminRole}</span>
        {" "}({impersonation.adminName})
      </span>
      <button
        type="button"
        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 transition-colors whitespace-nowrap"
        onClick={() => {
          void (async () => {
            await endImpersonation()
            router.push("/admin")
          })()
        }}
      >
        Back to Platform Admin <ArrowRight size={11} />
      </button>
    </div>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    debugDashboardShell({ event: "Dashboard shell mounted" })
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <ScreenshotModeGate />
      </Suspense>
      <ActiveOrganizationProvider>
        <BillingAccessProvider>
        <OrgPermissionsProvider>
        <TenantProvider>
          <ArchivedDashboardGate />
          <TenantWorkspaceSync />
          <OrganizationSwitchOverlay />
          <WorkOrderProvider>
            <MaintenanceProvider>
              <EquipmentProvider>
                <CustomerProvider>
                  <QuoteInvoiceProvider>
                    <PurchaseOrderProvider>
                    <EquipmentTypeProvider>
                      <SidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>
                        <div className="flex flex-col h-dvh overflow-hidden bg-background">
                          <DashboardGrowthSettingsShellInstrumentation />
                          <ImpersonationBanner />
                          <BillingWarningBanner />
                          <div className="flex flex-1 min-h-0 overflow-hidden">
                            <AppSidebar />
                            <DashboardWorkspaceShell>
                              <PageShell>{children}</PageShell>
                            </DashboardWorkspaceShell>
                          </div>
                          {/* Fixed launcher lives outside workspace overflow stacks; still not part of sidebar/nav RBAC */}
                          <AidenChatLauncher />
                          <Suspense fallback={null}>
                            <FirstRunWelcomeGate />
                          </Suspense>
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
        </OrgPermissionsProvider>
        </BillingAccessProvider>
      </ActiveOrganizationProvider>
    </>
  )
}
