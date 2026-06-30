"use client"

import { MessageSquare } from "lucide-react"
import { GrowthConversationsDashboardBody } from "@/components/growth/intelligence/growth-conversations-dashboard-body"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthConversationsPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Conversations"
        description="Deterministic conversation health, buying intent, objection severity, competitor pressure, and recovery signals — read-only intelligence."
        icon={MessageSquare}
        iconClassName="bg-emerald-50 text-emerald-600"
      />

      <GrowthConversationsDashboardBody />
    </GrowthWorkspacePageContent>
  )
}
