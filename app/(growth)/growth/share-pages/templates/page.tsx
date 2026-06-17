"use client"

import { LayoutTemplate } from "lucide-react"
import { GrowthSharePageTemplateLibrary } from "@/components/growth/share-pages/templates/growth-share-page-template-library"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthSharePageTemplatesPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Share Page Templates"
        description="Reusable Sendr-style layouts for future share page creation. Template publish updates the library only."
        icon={LayoutTemplate}
        iconClassName="bg-violet-50 text-violet-600"
      />
      <GrowthSharePageTemplateLibrary />
    </div>
  )
}
