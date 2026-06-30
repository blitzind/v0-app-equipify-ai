"use client"

import type { ReactNode } from "react"
import { Suspense } from "react"
import Link from "next/link"
import { CalendarClock, ExternalLink } from "lucide-react"
import { GrowthGoogleCalendarSettingsPanel } from "@/components/growth/growth-google-calendar-settings-panel"
import { GrowthMeetingLocationSettingsPanel } from "@/components/growth/growth-meeting-location-settings-panel"
import { GrowthMeetingsSchedulingReadinessSummary } from "@/components/growth/settings/growth-meetings-scheduling-readiness-summary"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import {
  GROWTH_SETTINGS_MEETINGS_REFINEMENT_2E_QA_MARKER,
  GROWTH_SETTINGS_SECTION_GAP,
} from "@/components/growth/growth-settings-ui"
import { Button } from "@/components/ui/button"

export const GROWTH_SETTINGS_CALENDAR_PREFERENCES_PAGE_QA_MARKER =
  "growth-settings-calendar-preferences-wiring-1a-v1" as const

function CalendarPreferencesFallback() {
  return <p className="text-sm text-muted-foreground">Loading calendar preferences…</p>
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

export function GrowthSettingsCalendarPreferencesPage() {
  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_SETTINGS_CALENDAR_PREFERENCES_PAGE_QA_MARKER}
      data-growth-settings-meetings-refinement={GROWTH_SETTINGS_MEETINGS_REFINEMENT_2E_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Calendar Preferences"
        description="Default meeting location, calendar connection, and scheduling defaults."
        icon={CalendarClock}
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={`${GROWTH_WORKSPACE_BASE_PATH}/settings/calendar`}>
              Calendar & booking
              <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
            </Link>
          </Button>
        }
      />

      <GrowthMeetingsSchedulingReadinessSummary />

      <MeetingsSettingsSection
        title="Meeting location"
        description="Workspace default for Google Meet, Teams, Zoom, phone, and in-person meetings."
      >
        <GrowthMeetingLocationSettingsPanel variant="operator" />
      </MeetingsSettingsSection>

      <MeetingsSettingsSection
        title="Calendar"
        description="Connect Google Calendar for meeting sync."
      >
        <Suspense fallback={<CalendarPreferencesFallback />}>
          <GrowthGoogleCalendarSettingsPanel variant="operator" />
        </Suspense>
      </MeetingsSettingsSection>
    </div>
  )
}
