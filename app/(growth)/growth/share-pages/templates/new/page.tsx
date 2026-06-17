"use client"

import { LayoutTemplate } from "lucide-react"
import { GrowthSharePageTemplateEditor } from "@/components/growth/share-pages/templates/growth-share-page-template-editor"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthSharePageTemplateNewPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="New Share Page Template"
        description="Create a reusable layout with sections, theme, and metadata."
        icon={LayoutTemplate}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthSharePageTemplateEditor />
    </div>
  )
}
