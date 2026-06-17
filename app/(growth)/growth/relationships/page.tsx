"use client"

import { Handshake } from "lucide-react"
import { GrowthRelationshipsDashboardBody } from "@/components/growth/intelligence/growth-relationships-dashboard-body"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthRelationshipsPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Relationship Intelligence"
        description="Meaningful touch depth, relationship strength tiers, executive attention signals, and queue prioritization — read-only intelligence, no send."
        icon={Handshake}
        iconClassName="bg-sky-50 text-sky-600"
      />

      <GrowthRelationshipsDashboardBody />
    </div>
  )
}
