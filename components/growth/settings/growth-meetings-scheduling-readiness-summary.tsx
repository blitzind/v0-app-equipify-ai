"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_SETTINGS_MEETINGS_REFINEMENT_2E_QA_MARKER,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
import type { GrowthCalendarConnectionSummary } from "@/lib/growth/calendar/google-calendar-types"
import type { GrowthBookingPageListItem } from "@/lib/growth/booking/booking-page-types"
import type { GrowthPlatformCommunicationSettings } from "@/lib/growth/communication/types"
import {
  GROWTH_MEETING_LOCATION_PROVIDER_LABELS,
  type GrowthMeetingLocationProvider,
} from "@/lib/growth/meeting-location/meeting-location-provider-types"

type SchedulingReadiness = {
  calendarConnected: boolean
  calendarLabel: string
  bookingPageLabel: string
  availabilityLabel: string
  meetingLocationLabel: string
}

function hasAvailabilityConfigured(pages: GrowthBookingPageListItem[]): boolean {
  return pages.some((page) => (page.availabilityWindows?.length ?? 0) > 0)
}

function meetingLocationLabel(provider: GrowthMeetingLocationProvider | undefined): string {
  if (!provider) return "Not set"
  return GROWTH_MEETING_LOCATION_PROVIDER_LABELS[provider] ?? "Configured"
}

export function GrowthMeetingsSchedulingReadinessSummary() {
  const [loading, setLoading] = useState(true)
  const [readiness, setReadiness] = useState<SchedulingReadiness | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [calendarRes, bookingRes, settingsRes] = await Promise.all([
        fetch("/api/platform/growth/calendar/connection", { cache: "no-store" }),
        fetch("/api/platform/growth/booking-pages", { cache: "no-store" }),
        fetch("/api/platform/growth/communication-settings", { cache: "no-store" }),
      ])

      const calendarData = (await calendarRes.json().catch(() => ({}))) as {
        ok?: boolean
        summary?: GrowthCalendarConnectionSummary
      }
      const bookingData = (await bookingRes.json().catch(() => ({}))) as {
        ok?: boolean
        pages?: GrowthBookingPageListItem[]
      }
      const settingsData = (await settingsRes.json().catch(() => ({}))) as {
        ok?: boolean
        settings?: GrowthPlatformCommunicationSettings
      }

      const summary = calendarData.summary
      const pages = bookingData.pages ?? []
      const settings = settingsData.settings
      const publishedPage = pages.find((page) => page.enabled)

      setReadiness({
        calendarConnected: Boolean(summary?.connected),
        calendarLabel: summary?.connected
          ? summary.accountEmail ?? "Google Calendar"
          : summary?.configured
            ? "Not connected"
            : "Setup required",
        bookingPageLabel: publishedPage ? "Published" : pages.length > 0 ? "Draft" : "None",
        availabilityLabel: hasAvailabilityConfigured(pages) ? "Configured" : "Not configured",
        meetingLocationLabel: meetingLocationLabel(settings?.defaultMeetingProvider),
      })
    } catch {
      setReadiness({
        calendarConnected: false,
        calendarLabel: "Unknown",
        bookingPageLabel: "Unknown",
        availabilityLabel: "Unknown",
        meetingLocationLabel: "Unknown",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div data-growth-settings-meetings-refinement={GROWTH_SETTINGS_MEETINGS_REFINEMENT_2E_QA_MARKER}>
      <GrowthSettingsCard title="Scheduling readiness">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading scheduling status…
          </p>
        ) : readiness ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Calendar connected"
              value={readiness.calendarConnected ? readiness.calendarLabel : "Not connected"}
            />
            <StatTile label="Booking page" value={readiness.bookingPageLabel} />
            <StatTile label="Availability" value={readiness.availabilityLabel} />
            <StatTile label="Meeting location" value={readiness.meetingLocationLabel} />
          </div>
        ) : null}
      </GrowthSettingsCard>
    </div>
  )
}
