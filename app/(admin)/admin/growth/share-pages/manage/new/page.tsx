"use client"

import { GrowthSharePageBuilder } from "@/components/growth/share-pages/growth-share-page-builder"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { useAdmin } from "@/lib/admin-store"

export default function AdminGrowthSharePagesManageNewPage() {
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
          <GrowthSharePageBuilder />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
