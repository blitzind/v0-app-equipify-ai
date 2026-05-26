"use client"

import { use } from "react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthLeadOperatorWorkspace } from "@/components/growth/lead-operator/growth-lead-operator-workspace"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"

type PageProps = { params: Promise<{ leadId: string }> }

export default function AdminGrowthLeadOperatorPage({ params }: PageProps) {
  const { leadId } = use(params)
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
        <GrowthSectionLayout>
          <GrowthLeadOperatorWorkspace leadId={leadId} />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
