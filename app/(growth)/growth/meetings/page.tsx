"use client"

import { CalendarClock } from "lucide-react"
import { GrowthMeetingIntelligenceDashboard } from "@/components/growth/growth-meeting-intelligence-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthMeetingsPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Meetings"
        description="Track booked meetings, outcomes, no-shows, and follow-ups — connect Google Calendar in Settings for human-confirmed sync."
        icon={CalendarClock}
        iconClassName="bg-indigo-50 text-indigo-600"
      />

      <GrowthMeetingIntelligenceDashboard />
    </GrowthWorkspacePageContent>
  )
}
