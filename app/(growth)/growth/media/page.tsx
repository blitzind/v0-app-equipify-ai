"use client"

import { Library } from "lucide-react"
import { GrowthContentLibraryDashboardView } from "@/components/growth/growth-content-library-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_CONTENT_LIBRARY_LAYOUT_ALIGNED_QA_MARKER } from "@/lib/growth/content/content-types"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthMediaPage() {
  return (
    <GrowthWorkspacePageContent data-qa={GROWTH_CONTENT_LIBRARY_LAYOUT_ALIGNED_QA_MARKER}>
      <GrowthWorkspacePageHeader
        title="Content Library"
        description="Governed templates and snippets for sequences, reply drafts, booking follow-ups, and manual tasks — approval required before live send, no unsafe merge fields."
        icon={Library}
        iconClassName="bg-violet-50 text-violet-600"
      />

      <GrowthContentLibraryDashboardView />
    </GrowthWorkspacePageContent>
  )
}
