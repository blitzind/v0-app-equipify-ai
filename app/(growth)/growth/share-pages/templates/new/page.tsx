"use client"

import { LayoutTemplate } from "lucide-react"
import { GrowthSharePageTemplateEditor } from "@/components/growth/share-pages/templates/growth-share-page-template-editor"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthSharePageTemplateNewPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="New Share Page Template"
        description="Create a reusable layout with sections, theme, and metadata."
        icon={LayoutTemplate}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthSharePageTemplateEditor />
    </GrowthWorkspacePageContent>
  )
}
