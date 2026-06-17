"use client"

import { useAdmin } from "@/lib/admin-store"
import { GrowthOpportunitiesOperatorWorkspace } from "@/components/growth/opportunities/growth-opportunities-operator-workspace"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"

export default function AdminGrowthOpportunityWorkspacePage() {
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
        <GrowthOpportunitiesOperatorWorkspace />
      </div>
    </PlatformAdminPageShell>
  )
}
