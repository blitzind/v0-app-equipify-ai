"use client"

import { CalendarPlus, CheckCircle2, ExternalLink, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatSlotDateTimeLabel } from "@/lib/growth/booking/booking-availability-ui"
import {
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  downloadIcsCalendarFile,
} from "@/lib/growth/booking/booking-public-calendar-links"
import { formatTimezoneLabel } from "@/lib/growth/booking/booking-public-timezone"
import { GROWTH_BOOKING_PAGE_UI_QA_MARKER } from "@/lib/growth/booking/booking-page-ui-types"
import { cn } from "@/lib/utils"

type PublicBookingSuccessProps = {
  accentColor: string
  pageTitle: string
  message: string
  slotStartAt: string
  slotEndAt: string
  displayTimezone: string
  locationLabel: string | null
  meetingUrl: string | null
  locationUrl: string | null
  onBookAnother: () => void
}

export function PublicBookingSuccess({
  accentColor,
  pageTitle,
  message,
  slotStartAt,
  slotEndAt,
  displayTimezone,
  locationLabel,
  meetingUrl,
  locationUrl,
  onBookAnother,
}: PublicBookingSuccessProps) {
  const calendarEvent = {
    title: pageTitle,
    description: message,
    location: locationLabel ?? meetingUrl ?? "",
    startAtIso: slotStartAt,
    endAtIso: slotEndAt,
  }

  const meetingLink = meetingUrl ?? locationUrl

  return (
    <div
      className="min-h-screen bg-slate-100/80 px-4 py-10 dark:bg-slate-950"
      data-qa-marker={GROWTH_BOOKING_PAGE_UI_QA_MARKER}
    >
      <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_20px_60px_rgb(0,0,0,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_20px_60px_rgb(0,0,0,0.45)]">
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${accentColor}, color-mix(in srgb, ${accentColor} 60%, #6366f1))` }} />

        <div className="p-8 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <div
              className={cn(
                "flex size-16 items-center justify-center rounded-full motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-500",
              )}
              style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
            >
              <CheckCircle2 className="size-9" aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight">You&apos;re scheduled!</h1>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">{message}</p>
          </div>

          <div className="mt-8 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-5 text-sm dark:border-slate-800 dark:bg-slate-950/50">
            <p className="text-lg font-semibold">{formatSlotDateTimeLabel(slotStartAt, displayTimezone)}</p>
            <p className="text-muted-foreground">{formatTimezoneLabel(displayTimezone)}</p>
            {locationLabel ? (
              <p>
                <span className="font-medium text-foreground">Location:</span> {locationLabel}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">A calendar invitation will be sent to your email.</p>
          </div>

          <div className="mt-6">
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add to calendar</p>
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-xl text-xs" asChild>
                <a href={buildGoogleCalendarUrl(calendarEvent)} target="_blank" rel="noreferrer">
                  Google
                </a>
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-xl text-xs" asChild>
                <a href={buildOutlookCalendarUrl(calendarEvent)} target="_blank" rel="noreferrer">
                  Outlook
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl text-xs"
                onClick={() => downloadIcsCalendarFile(calendarEvent)}
              >
                <CalendarPlus className="mr-1 size-3.5" />
                ICS
              </Button>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {meetingLink ? (
              <Button
                type="button"
                className="h-12 flex-1 rounded-xl text-base font-semibold text-white shadow-lg"
                style={{ backgroundColor: accentColor }}
                asChild
              >
                <a href={meetingLink} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 size-4" />
                  View meeting
                </a>
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="h-12 flex-1 rounded-xl" onClick={onBookAnother}>
              <RotateCcw className="mr-2 size-4" />
              Book another
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
