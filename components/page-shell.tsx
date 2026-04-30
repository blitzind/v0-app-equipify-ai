"use client"

import { usePathname } from "next/navigation"
import { AppTopbar } from "@/components/app-topbar"

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/customers": "Customers",
  "/equipment": "Equipment",
  "/work-orders": "Work Orders",
  "/service-schedule": "Service Schedule",
  "/maintenance-plans": "Maintenance Plans",
  "/technicians": "Technicians",
  "/reports": "Reports",
  "/insights": "AI Insights",
  "/customer-portal": "Customer Portal",
  "/billing": "Billing",
  "/settings": "Settings",
  "/settings/workspace": "Settings — Workspace",
  "/settings/team": "Settings — Team",
  "/settings/billing": "Settings — Billing",
  "/settings/permissions": "Settings — Permissions",
}

function resolveTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  if (pathname.startsWith("/customers/")) return "Customer Detail"
  if (pathname.startsWith("/equipment/")) return "Equipment Detail"
  if (pathname.startsWith("/work-orders/")) return "Work Order Detail"
  if (pathname.startsWith("/maintenance-plans")) return "Maintenance Plans"
  if (pathname.startsWith("/service-schedule")) return "Service Schedule"
  if (pathname.startsWith("/settings/")) return "Settings"
  return "Equipify.ai"
}

export function PageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const title = resolveTitle(pathname)

  return (
    <>
      <AppTopbar title={title} />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </>
  )
}
