"use client"

import { useAdmin } from "@/lib/admin-store"
import { GrowthOpportunitiesReadinessWorkspace } from "@/components/growth/opportunities/growth-opportunities-readiness-workspace"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"

export default function AdminGrowthOpportunitiesPage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <PlatformAdminTabNav activeKey="growth_leads" />
        <GrowthOpportunitiesReadinessWorkspace />
      </div>
    </PlatformAdminPageShell>
  )
}
