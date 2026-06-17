"use client"

import { MessageSquare } from "lucide-react"
import { GrowthConversationsWorkspace } from "@/components/growth/intelligence/growth-conversations-workspace"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthConversationsPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Conversation Intelligence"
        description="Deterministic conversation health, buying intent, objection severity, competitor pressure, and recovery signals — read-only intelligence."
        icon={MessageSquare}
        iconClassName="bg-emerald-50 text-emerald-600"
      />

      <GrowthConversationsWorkspace showPageHeader={false} />
    </div>
  )
}
