"use client"

import { Inbox } from "lucide-react"
import { GrowthCapturedLeadsDashboard } from "@/components/growth/growth-captured-leads-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthLeadsCapturedPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Recently Captured"
        description="Follow up on manual entries and Chrome extension captures. Review, verify, queue discovery, or prepare call/sequence work — no outreach sends automatically."
        icon={Inbox}
        iconClassName="bg-indigo-50 text-indigo-600"
      />

      <GrowthCapturedLeadsDashboard />
    </GrowthWorkspacePageContent>
  )
}
