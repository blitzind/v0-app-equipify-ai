"use client"

import { Activity } from "lucide-react"
import { GeV15AutomationRuntimeApprovalInbox } from "@/components/growth/automation/ge-v1-5-automation-runtime-approval-inbox"
import { GrowthEngagementCommandCenter } from "@/components/growth/engagement/growth-engagement-command-center"
import { GrowthUnifiedEngagementFeed } from "@/components/growth/engagement/growth-unified-engagement-feed"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthEngagementPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Engagement"
        description="One command center for prospect engagement — video views, CTAs, replies, bookings, and high-intent signals."
        icon={Activity}
        iconClassName="bg-emerald-50 text-emerald-600"
      />

      <div className="space-y-8">
        <GeV15AutomationRuntimeApprovalInbox limit={10} />
        <GrowthUnifiedEngagementFeed limit={50} />
        <GrowthEngagementCommandCenter />
      </div>
    </GrowthWorkspacePageContent>
  )
}
