"use client"

import { PortalRoot } from "@/components/portal/portal-root"
import { Toaster } from "@/components/ui/sonner"

export default function PortalGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PortalRoot>{children}</PortalRoot>
      <Toaster />
    </>
  )
}
