"use client"

import { Library } from "lucide-react"
import { GrowthContentLibraryDashboardView } from "@/components/growth/growth-content-library-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_CONTENT_LIBRARY_LAYOUT_ALIGNED_QA_MARKER } from "@/lib/growth/content/content-types"

export default function GrowthMediaPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8" data-qa={GROWTH_CONTENT_LIBRARY_LAYOUT_ALIGNED_QA_MARKER}>
      <GrowthWorkspacePageHeader
        title="Content Library"
        description="Governed templates and snippets for sequences, reply drafts, booking follow-ups, and manual tasks — approval required before live send, no unsafe merge fields."
        icon={Library}
        iconClassName="bg-violet-50 text-violet-600"
      />

      <GrowthContentLibraryDashboardView />
    </div>
  )
}
