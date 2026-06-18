"use client"

import { FileText } from "lucide-react"
import { GrowthSharePagesDashboard } from "@/components/growth/share-pages/growth-share-pages-admin-panel"
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
      <GrowthSharePagesDashboard />
    </GrowthWorkspacePageContent>
  )
}
