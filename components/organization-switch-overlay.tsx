"use client"

import { useActiveOrganization } from "@/lib/active-organization-context"

export function OrganizationSwitchOverlay() {
  const { switching } = useActiveOrganization()
  if (!switching) return null
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-background/50 backdrop-blur-[1px]"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium shadow-lg">
        Switching organization…
      </div>
    </div>
  )
}
