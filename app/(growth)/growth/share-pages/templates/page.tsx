"use client"

import { LayoutTemplate } from "lucide-react"
import { GrowthSharePageTemplateLibrary } from "@/components/growth/share-pages/templates/growth-share-page-template-library"
import { GrowthSharePagesWorkspaceTabs } from "@/components/growth/share-pages/growth-share-pages-workspace-tabs"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthSharePageTemplatesPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Share Page Templates"
        description="Reusable share page template layouts for future share page creation. Template publish updates the library only."
        icon={LayoutTemplate}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthSharePagesWorkspaceTabs />
      <GrowthSharePageTemplateLibrary />
    </GrowthWorkspacePageContent>
  )
}
