"use client"

import { useAdmin } from "@/lib/admin-store"
import { GrowthReplyWorkflowWorkspace } from "@/components/growth/replies/growth-reply-workflow-workspace"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"

export default function AdminGrowthReplyWorkflowPage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
        <PlatformAdminTabNav activeKey="growth_leads" />
        <GrowthReplyWorkflowWorkspace />
      </div>
    </PlatformAdminPageShell>
  )
}
