"use client"

import { Handshake } from "lucide-react"
import { GrowthRelationshipsDashboardBody } from "@/components/growth/intelligence/growth-relationships-dashboard-body"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthRelationshipsPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Relationships"
        description="Meaningful touch depth, relationship strength tiers, executive attention signals, and queue prioritization — read-only intelligence, no send."
        icon={Handshake}
        iconClassName="bg-sky-50 text-sky-600"
      />

      <GrowthRelationshipsDashboardBody />
    </GrowthWorkspacePageContent>
  )
}
