"use client"

import { FileText } from "lucide-react"
import { GrowthSharePagesDashboard } from "@/components/growth/share-pages/growth-share-pages-admin-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthSharePagesManagePage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Manage Share Pages"
        description="Create, preview, approve, and review personalized share pages. Passive delivery only; no sends or enrollments."
        icon={FileText}
        iconClassName="bg-emerald-50 text-emerald-600"
      />
      <GrowthSharePagesDashboard />
    </div>
  )
}
