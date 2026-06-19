"use client"

import { FileText } from "lucide-react"
import { GrowthSharePagesManagePanel } from "@/components/growth/share-pages/growth-share-page-manage-panel"
import { GrowthSharePagesWorkspaceTabs } from "@/components/growth/share-pages/growth-share-pages-workspace-tabs"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthSharePagesManagePage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Manage Share Pages"
        description="Create, preview, approve, and review personalized share pages. Passive delivery only; no sends or enrollments."
        icon={FileText}
        iconClassName="bg-emerald-50 text-emerald-600"
      />
      <GrowthSharePagesWorkspaceTabs />
      <GrowthSharePagesManagePanel basePath="/growth/share-pages/manage" />
    </GrowthWorkspacePageContent>
  )
}
