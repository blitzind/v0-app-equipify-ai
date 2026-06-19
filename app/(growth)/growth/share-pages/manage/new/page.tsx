"use client"

import { GrowthSharePageBuilder } from "@/components/growth/share-pages/growth-share-page-builder"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthSharePagesManageNewPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthSharePageBuilder />
    </GrowthWorkspacePageContent>
  )
}
