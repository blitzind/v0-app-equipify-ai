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
  "/customer-portal": "Customer Portal",
  "/billing": "Billing",
  "/settings": "Settings",
}

function resolveTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname]
  if (pathname.startsWith("/customers/")) return "Customer Detail"
  if (pathname.startsWith("/equipment/")) return "Equipment Detail"
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
