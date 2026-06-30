"use client"

import type { ReactNode } from "react"
import { Suspense } from "react"
import { Calendar } from "lucide-react"
import { GrowthBookingPagesPanel } from "@/components/growth/growth-booking-pages-panel"
import { GrowthGoogleCalendarSettingsPanel } from "@/components/growth/growth-google-calendar-settings-panel"
import { GrowthMeetingLocationSettingsPanel } from "@/components/growth/growth-meeting-location-settings-panel"
import { GrowthMeetingsSchedulingReadinessSummary } from "@/components/growth/settings/growth-meetings-scheduling-readiness-summary"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import {
  GROWTH_SETTINGS_MEETINGS_REFINEMENT_2E_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"

export const GROWTH_SETTINGS_CALENDAR_PAGE_QA_MARKER = "growth-settings-calendar-wiring-1a-v1" as const

function CalendarPanelsFallback() {
  return <p className="text-sm text-muted-foreground">Loading calendar settings…</p>
}

function MeetingsSettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  const sectionId = `meetings-section-${title.replace(/\s+/g, "-").toLowerCase()}`
  return (
    <section className="space-y-3" aria-labelledby={sectionId}>
      <div>
        <h2 id={sectionId} className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function GrowthSettingsCalendarPage() {
  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_SETTINGS_CALENDAR_PAGE_QA_MARKER}
      data-growth-settings-meetings-refinement={GROWTH_SETTINGS_MEETINGS_REFINEMENT_2E_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Calendar & Booking"
        description="Connect your calendar, publish booking pages, and configure meeting locations."
        icon={Calendar}
      />

      <GrowthMeetingsSchedulingReadinessSummary />

      <MeetingsSettingsSection
        title="Calendar"
        description="Google Calendar connection and sync status."
      >
        <Suspense fallback={<CalendarPanelsFallback />}>
          <GrowthGoogleCalendarSettingsPanel variant="operator" />
        </Suspense>
      </MeetingsSettingsSection>

      <MeetingsSettingsSection
        title="Booking"
        description="Public booking pages, meeting types, and confirmation behavior."
      >
        <GrowthBookingPagesPanel variant="operator" />
      </MeetingsSettingsSection>

      <MeetingsSettingsSection
        title="Meeting location"
        description="Default video conference and in-person meeting options."
      >
        <GrowthMeetingLocationSettingsPanel variant="operator" />
      </MeetingsSettingsSection>
    </div>
  )
}
