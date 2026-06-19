"use client"

import { CalendarClock } from "lucide-react"
import { GrowthBookingIntelligenceDashboardView } from "@/components/growth/growth-booking-intelligence-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthCampaignsBookingIntelligencePage() {
  return (
    <GrowthWorkspacePageContent data-growth-workspace-booking-intelligence="v1">
      <GrowthWorkspacePageHeader
        title="Booking Intelligence"
        description="Meeting intent, booking recommendations, calendar routing, and conversion attribution — human approval required."
        icon={CalendarClock}
        iconClassName="bg-sky-50 text-sky-700"
      />

      <GrowthSectionLayout>
        <GrowthBookingIntelligenceDashboardView />
      </GrowthSectionLayout>
    </GrowthWorkspacePageContent>
  )
}
