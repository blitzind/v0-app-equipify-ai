"use client"

import { Sparkles } from "lucide-react"
import { GrowthLiveCoachingDashboard } from "@/components/growth/growth-live-coaching-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthCallsCoachingPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Live Coaching"
        description="Operator execution scores, guidance effectiveness, and high-risk call patterns — human in control, no autonomous actions."
        icon={Sparkles}
        iconClassName="bg-emerald-50 text-emerald-700"
      />

      <GrowthLiveCoachingDashboard />
    </div>
  )
}
