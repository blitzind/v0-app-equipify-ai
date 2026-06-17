"use client"

import { CalendarClock } from "lucide-react"
import { GrowthMeetingIntelligenceDashboard } from "@/components/growth/growth-meeting-intelligence-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthMeetingsPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="Meeting Intelligence"
        description="Track booked meetings, outcomes, no-shows, and follow-ups — connect Google Calendar in Settings for human-confirmed sync."
        icon={CalendarClock}
        iconClassName="bg-indigo-50 text-indigo-600"
      />

      <GrowthMeetingIntelligenceDashboard />
    </div>
  )
}
