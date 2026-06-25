"use client"

import { Suspense } from "react"
import { Search } from "lucide-react"
import { GrowthProspectSearchAdmin } from "@/components/growth/prospect-search/growth-prospect-search-admin"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

function ProspectSearchFallback() {
  return <p className="text-sm text-muted-foreground">Loading prospect search…</p>
}

export default function GrowthLeadsProspectSearchPage() {
  return (
    <GrowthWorkspacePageContent data-growth-workspace-prospect-search="v1">
      <GrowthWorkspacePageHeader
        title="Prospect Search"
        description="AI-guided account discovery with ICP recommendations, saved searches, and review-first results."
        icon={Search}
        iconClassName="bg-cyan-50 text-cyan-700"
      />

      <Suspense fallback={<ProspectSearchFallback />}>
        <GrowthProspectSearchAdmin />
      </Suspense>
    </GrowthWorkspacePageContent>
  )
}
