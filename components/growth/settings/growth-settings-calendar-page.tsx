"use client"

import { Suspense } from "react"
import { Calendar } from "lucide-react"
import { GrowthBookingPagesPanel } from "@/components/growth/growth-booking-pages-panel"
import { GrowthGoogleCalendarSettingsPanel } from "@/components/growth/growth-google-calendar-settings-panel"
import { GrowthMeetingLocationSettingsPanel } from "@/components/growth/growth-meeting-location-settings-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"

export const GROWTH_SETTINGS_CALENDAR_PAGE_QA_MARKER = "growth-settings-calendar-wiring-1a-v1" as const

function CalendarPanelsFallback() {
  return <p className="text-sm text-muted-foreground">Loading calendar settings…</p>
}

export function GrowthSettingsCalendarPage() {
  return (
    <div className={GROWTH_SETTINGS_SECTION_GAP} data-qa-marker={GROWTH_SETTINGS_CALENDAR_PAGE_QA_MARKER}>
      <GrowthWorkspacePageHeader
        title="Calendar & Booking"
        description="Connect Google Calendar, manage booking pages, availability, and scheduling links."
        icon={Calendar}
      />
      <Suspense fallback={<CalendarPanelsFallback />}>
        <GrowthGoogleCalendarSettingsPanel />
      </Suspense>
      <GrowthMeetingLocationSettingsPanel />
      <GrowthBookingPagesPanel />
    </div>
  )
}
