"use client"

import { Suspense } from "react"
import Link from "next/link"
import { CalendarClock } from "lucide-react"
import { GrowthGoogleCalendarSettingsPanel } from "@/components/growth/growth-google-calendar-settings-panel"
import { GrowthMeetingLocationSettingsPanel } from "@/components/growth/growth-meeting-location-settings-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

export const GROWTH_SETTINGS_CALENDAR_PREFERENCES_PAGE_QA_MARKER =
  "growth-settings-calendar-preferences-wiring-1a-v1" as const

function CalendarPreferencesFallback() {
  return <p className="text-sm text-muted-foreground">Loading calendar preferences…</p>
}

export function GrowthSettingsCalendarPreferencesPage() {
  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_SETTINGS_CALENDAR_PREFERENCES_PAGE_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Calendar Preferences"
        description="Default meeting location, calendar connection, and booking behavior for operator outreach."
        icon={CalendarClock}
        iconClassName="bg-emerald-50 text-emerald-700"
        actions={
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={`${GROWTH_WORKSPACE_BASE_PATH}/settings/calendar`}>
              Manage booking pages
              <ExternalLink className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        }
      />
      <GrowthMeetingLocationSettingsPanel />
      <Suspense fallback={<CalendarPreferencesFallback />}>
        <GrowthGoogleCalendarSettingsPanel />
      </Suspense>
    </div>
  )
}
