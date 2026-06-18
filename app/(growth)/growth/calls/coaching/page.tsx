"use client"

import { Sparkles } from "lucide-react"
import { GrowthLiveCoachingDashboard } from "@/components/growth/growth-live-coaching-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthCallsCoachingPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Live Coaching"
        description="Operator execution scores, guidance effectiveness, and high-risk call patterns — human in control, no autonomous actions."
        icon={Sparkles}
        iconClassName="bg-emerald-50 text-emerald-700"
      />

      <GrowthLiveCoachingDashboard />
    </GrowthWorkspacePageContent>
  )
}
