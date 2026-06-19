"use client"

import { Suspense } from "react"
import { Search } from "lucide-react"
import { GrowthProspectSearchAdmin } from "@/components/growth/prospect-search/growth-prospect-search-admin"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

function ProspectSearchDiscoverFallback() {
  return <p className="text-sm text-muted-foreground">Loading company discovery…</p>
}

/** Discover mode defaults to external discovery — same shell, dedicated workspace route. */
export default function GrowthLeadsProspectSearchDiscoverPage() {
  return (
    <GrowthWorkspacePageContent data-growth-workspace-prospect-search-discover="v1">
      <GrowthWorkspacePageHeader
        title="Discover Companies"
        description="External company discovery — find new accounts matching your ICP."
        icon={Search}
        iconClassName="bg-cyan-50 text-cyan-700"
      />

      <Suspense fallback={<ProspectSearchDiscoverFallback />}>
        <GrowthProspectSearchAdmin />
      </Suspense>
    </GrowthWorkspacePageContent>
  )
}
