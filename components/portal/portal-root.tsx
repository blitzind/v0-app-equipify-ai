"use client"

import { usePathname } from "next/navigation"
import { PortalSessionProvider } from "@/components/portal/portal-session-context"
import { PortalShell } from "@/components/portal/portal-shell"

export function PortalRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/portal/login") {
    return <>{children}</>
  }
  if (pathname === "/portal/preview" || pathname?.startsWith("/portal/preview/")) {
    return <>{children}</>
  }

  return (
    <PortalSessionProvider>
      <PortalShell>{children}</PortalShell>
    </PortalSessionProvider>
  )
}
