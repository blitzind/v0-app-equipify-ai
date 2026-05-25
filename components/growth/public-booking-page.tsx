"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Loader2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PublicBookingCalendar } from "@/components/growth/public-booking/public-booking-calendar"
import {
  calendarDateToSlotKey,
  datesWithAvailableSlots,
  formatDateKeyLabel,
  formatSlotDateTimeLabel,
  formatSlotTimeLabel,
  groupSlotsByDateKey,
  parseDateKey,
} from "@/lib/growth/booking/booking-availability-ui"
import { GROWTH_BOOKING_PAGE_UI_QA_MARKER } from "@/lib/growth/booking/booking-page-ui-types"
import {
  formatTimezoneLabel,
  resolveVisitorTimezone,
  visitorTimezoneHelperCopy,
} from "@/lib/growth/booking/booking-public-timezone"
import type { GrowthBookingPagePublicView, GrowthBookingSlot } from "@/lib/growth/booking/booking-page-types"
import { cn } from "@/lib/utils"

type BookingPageProps = {
  slug: string
}

type BookingStep = "date" | "time" | "details"

type BookingSuccessState = {
  message: string
  slotStartAt: string
  slotEndAt: string
  meetingUrl: string | null
  locationLabel: string | null
  locationUrl: string | null
}

function EventDetailsPanel({
  page,
  displayTimezone,
  pageTimezone,
}: {
  page: GrowthBookingPagePublicView
  displayTimezone: string
  pageTimezone: string
}) {
  const accentColor = page.accentColor ?? page.brandColor ?? "#2563eb"
  const brandColor = page.brandColor ?? accentColor

  return (
    <div className="relative overflow-hidden rounded-2xl lg:rounded-none lg:rounded-l-2xl">
      {page.heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.heroImageUrl} alt="" className="h-36 w-full object-cover lg:h-40" />
      ) : (
        <div
          className="h-28 w-full lg:h-32"
          style={{
            background: `linear-gradient(135deg, ${brandColor}22 0%, ${accentColor}44 55%, ${brandColor}18 100%)`,
          }}
        />
      )}

      <div
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ backgroundColor: accentColor }}
        aria-hidden
      />

      <div className="space-y-5 p-6 lg:p-8">
        {page.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.logoUrl} alt="" className="max-h-10 w-auto max-w-[180px] object-contain" />
        ) : null}

        {page.brandName ? (
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: accentColor }}>
            {page.brandName}
          </p>
        ) : null}

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]" style={{ color: brandColor }}>
            {page.pageTitle}
          </h1>
          {page.description ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">{page.description}</p>
          ) : null}
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
            >
              <Clock3 className="size-4" aria-hidden />
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Duration</dt>
              <dd className="font-medium text-foreground">{page.durationMinutes} minutes</dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
            >
              <CalendarDays className="size-4" aria-hidden />
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Timezone</dt>
              <dd className="font-medium text-foreground">{formatTimezoneLabel(displayTimezone)}</dd>
              {displayTimezone !== pageTimezone ? (
                <dd className="text-xs text-muted-foreground">Host: {formatTimezoneLabel(pageTimezone)}</dd>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
            >
              <MapPin className="size-4" aria-hidden />
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</dt>
              <dd className="font-medium text-foreground">{page.locationLabel}</dd>
            </div>
          </div>
        </dl>

        {page.footerNote ? <p className="border-t border-border/60 pt-4 text-xs leading-relaxed text-muted-foreground">{page.footerNote}</p> : null}
      </div>
    </div>
  )
}

function StepIndicator({ step, accentColor }: { step: BookingStep; accentColor: string }) {
  const steps: { id: BookingStep; label: string }[] = [
    { id: "date", label: "Date" },
    { id: "time", label: "Time" },
    { id: "details", label: "Details" },
  ]
  const activeIndex = steps.findIndex((item) => item.id === step)

  return (
    <ol className="mb-6 flex items-center gap-2 text-xs font-medium sm:text-sm" aria-label="Booking steps">
      {steps.map((item, index) => {
        const isActive = index === activeIndex
        const isComplete = index < activeIndex
        return (
          <li key={item.id} className="flex items-center gap-2">
            {index > 0 ? <span className="text-muted-foreground/50">/</span> : null}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
                isActive && "font-semibold text-foreground",
                isComplete && "text-muted-foreground",
                !isActive && !isComplete && "text-muted-foreground/70",
              )}
              style={isActive ? { backgroundColor: `${accentColor}18`, color: accentColor } : undefined}
            >
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full text-[11px]",
                  isActive || isComplete ? "text-white" : "bg-muted text-muted-foreground",
                )}
                style={isActive || isComplete ? { backgroundColor: accentColor } : undefined}
              >
                {index + 1}
              </span>
              {item.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function TimezoneSelect({
  displayTimezone,
  pageTimezone,
  visitorTimezone,
  onChange,
}: {
  displayTimezone: string
  pageTimezone: string
  visitorTimezone: string
  onChange: (value: string) => void
}) {
  const options = useMemo(() => [...new Set([visitorTimezone, pageTimezone])], [visitorTimezone, pageTimezone])

  return (
    <div className="space-y-1">
      <Label htmlFor="booking-display-timezone" className="text-xs text-muted-foreground">
        Timezone
      </Label>
      <select
        id="booking-display-timezone"
        value={displayTimezone}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {options.map((tz) => (
          <option key={tz} value={tz}>
            {tz === visitorTimezone ? `${formatTimezoneLabel(tz)} (your timezone)` : `${formatTimezoneLabel(tz)} (host)`}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">{visitorTimezoneHelperCopy(displayTimezone)}</p>
    </div>
  )
}

export default function PublicBookingPage({ slug }: BookingPageProps) {
  const [page, setPage] = useState<GrowthBookingPagePublicView | null>(null)
  const [slots, setSlots] = useState<GrowthBookingSlot[]>([])
  const [pageTimezone, setPageTimezone] = useState("UTC")
  const [visitorTimezone, setVisitorTimezone] = useState("UTC")
  const [displayTimezone, setDisplayTimezone] = useState("UTC")
  const [step, setStep] = useState<BookingStep>("date")
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<GrowthBookingSlot | null>(null)
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => new Date())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<BookingSuccessState | null>(null)
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", notes: "" })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pageRes, slotsRes] = await Promise.all([
        fetch(`/api/book/${encodeURIComponent(slug)}`, { cache: "no-store" }),
        fetch(`/api/book/${encodeURIComponent(slug)}/slots`, { cache: "no-store" }),
      ])
      const pageData = (await pageRes.json().catch(() => ({}))) as { ok?: boolean; page?: GrowthBookingPagePublicView; message?: string }
      const slotsData = (await slotsRes.json().catch(() => ({}))) as {
        ok?: boolean
        slots?: GrowthBookingSlot[]
        timezone?: string
        message?: string
      }
      if (!pageRes.ok || !pageData.ok || !pageData.page) {
        throw new Error(pageData.message ?? "Booking page not found.")
      }
      if (!slotsRes.ok || !slotsData.ok) {
        throw new Error(slotsData.message ?? "Could not load availability.")
      }
      const canonicalTimezone = slotsData.timezone ?? pageData.page.timezone
      const detectedTimezone = resolveVisitorTimezone(canonicalTimezone)
      setPage(pageData.page)
      setSlots(slotsData.slots ?? [])
      setPageTimezone(canonicalTimezone)
      setVisitorTimezone(detectedTimezone)
      setDisplayTimezone(detectedTimezone)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking page unavailable.")
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  const slotsByDate = useMemo(() => groupSlotsByDateKey(slots, displayTimezone), [slots, displayTimezone])
  const availableDateKeys = useMemo(() => datesWithAvailableSlots(slots, displayTimezone), [slots, displayTimezone])
  const todayKey = useMemo(() => calendarDateToSlotKey(new Date(), displayTimezone), [displayTimezone])
  const selectedDaySlots = selectedDateKey ? slotsByDate.get(selectedDateKey) ?? [] : []
  const accentColor = page?.accentColor ?? page?.brandColor ?? "#2563eb"
  const selectedCalendarDate = selectedDateKey ? parseDateKey(selectedDateKey) : undefined

  async function submitBooking() {
    if (!selectedSlot || !page) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/book/${encodeURIComponent(slug)}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          slotStartAt: selectedSlot.startAt,
          slotEndAt: selectedSlot.endAt,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        confirmationMessage?: string | null
        meetingUrl?: string | null
        locationLabel?: string | null
        locationUrl?: string | null
        slotStartAt?: string
        slotEndAt?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Booking failed.")
      setSuccess({
        message: data.confirmationMessage ?? "Your meeting is confirmed.",
        slotStartAt: data.slotStartAt ?? selectedSlot.startAt,
        slotEndAt: data.slotEndAt ?? selectedSlot.endAt,
        meetingUrl: data.meetingUrl ?? null,
        locationLabel: data.locationLabel ?? page.locationLabel,
        locationUrl: data.locationUrl ?? page.locationUrl,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-muted-foreground dark:bg-slate-950">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading booking page…
      </div>
    )
  }

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center dark:bg-slate-950">
        <div>
          <h1 className="text-lg font-semibold">Booking page unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error ?? "This booking link is disabled or does not exist."}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950" data-qa-marker={GROWTH_BOOKING_PAGE_UI_QA_MARKER}>
        <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />
          <div className="p-8">
            <div className="flex items-start gap-4">
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
              >
                <CheckCircle2 className="size-7" aria-hidden />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">You&apos;re scheduled</h1>
                <p className="mt-1 text-sm text-muted-foreground">{success.message}</p>
              </div>
            </div>
            <div className="mt-6 space-y-2 rounded-xl bg-muted/30 p-5 text-sm dark:bg-slate-950/50">
              <p className="text-base font-semibold">{formatSlotDateTimeLabel(success.slotStartAt, displayTimezone)}</p>
              <p className="text-muted-foreground">{formatTimezoneLabel(displayTimezone)}</p>
              {success.locationLabel ? (
                <p className="pt-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Location:</span> {success.locationLabel}
                </p>
              ) : null}
              {success.meetingUrl || success.locationUrl ? (
                <a
                  href={success.meetingUrl ?? success.locationUrl ?? "#"}
                  className="inline-flex pt-2 text-sm font-semibold underline-offset-4 hover:underline"
                  style={{ color: accentColor }}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open meeting link
                </a>
              ) : (
                <p className="pt-2 text-xs text-muted-foreground">A calendar invitation will be sent to your email.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:py-10" data-qa-marker={GROWTH_BOOKING_PAGE_UI_QA_MARKER}>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(360px,400px)_minmax(0,1fr)] lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border/70 lg:bg-white lg:shadow-sm dark:lg:border-slate-800 dark:lg:bg-slate-900">
        <aside className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:rounded-none lg:border-0 lg:shadow-none">
          <EventDetailsPanel page={page} displayTimezone={displayTimezone} pageTimezone={pageTimezone} />
        </aside>

        <section className="flex min-h-[32rem] flex-col rounded-2xl border border-border/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8 lg:min-h-[36rem] lg:rounded-none lg:border-0 lg:p-10 lg:shadow-none">
          <StepIndicator step={step} accentColor={accentColor} />

          {step === "date" ? (
            <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center space-y-5">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Select a date</h2>
                <p className="mt-1 text-sm text-muted-foreground">Choose an available day to see open times.</p>
              </div>

              <PublicBookingCalendar
                accentColor={accentColor}
                month={visibleMonth}
                onMonthChange={setVisibleMonth}
                selected={selectedCalendarDate}
                onSelect={(date) => {
                  if (!date) return
                  const key = calendarDateToSlotKey(date, displayTimezone)
                  if (key < todayKey || !availableDateKeys.has(key)) return
                  setSelectedDateKey(key)
                  setSelectedSlot(null)
                  setError(null)
                  setStep("time")
                }}
                disabled={(date) => {
                  const key = calendarDateToSlotKey(date, displayTimezone)
                  return key < todayKey || !availableDateKeys.has(key)
                }}
                available={(date) => availableDateKeys.has(calendarDateToSlotKey(date, displayTimezone))}
              />
            </div>
          ) : null}

          {step === "time" ? (
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Select a time</h2>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {selectedDateKey ? formatDateKeyLabel(selectedDateKey, displayTimezone) : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 shrink-0 px-2 text-xs font-medium"
                  style={{ color: accentColor }}
                  onClick={() => {
                    setStep("date")
                    setSelectedSlot(null)
                    setError(null)
                  }}
                >
                  Change date
                </Button>
              </div>

              <TimezoneSelect
                displayTimezone={displayTimezone}
                pageTimezone={pageTimezone}
                visitorTimezone={visitorTimezone}
                onChange={(value) => {
                  setDisplayTimezone(value)
                  if (selectedDateKey) {
                    const stillAvailable = groupSlotsByDateKey(slots, value).has(selectedDateKey)
                    if (!stillAvailable) {
                      setSelectedDateKey(null)
                      setStep("date")
                    }
                  }
                }}
              />

              {selectedDaySlots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground dark:border-slate-800">
                  No available times this day. Pick another date.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5" style={{ "--booking-accent": accentColor } as CSSProperties}>
                  {selectedDaySlots.map((slot) => {
                    const isSelected = selectedSlot?.startAt === slot.startAt
                    return (
                      <Button
                        key={slot.startAt}
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-11 justify-center text-sm font-semibold transition-colors",
                          isSelected
                            ? "border-transparent bg-[var(--booking-accent)] text-white shadow-sm"
                            : "border-[color-mix(in_srgb,var(--booking-accent)_40%,transparent)] bg-background text-[var(--booking-accent)] hover:border-[var(--booking-accent)] hover:bg-[var(--booking-accent)] hover:text-white",
                        )}
                        onClick={() => {
                          setSelectedSlot(slot)
                          setError(null)
                          setStep("details")
                        }}
                      >
                        {formatSlotTimeLabel(slot.startAt, displayTimezone)}
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}

          {step === "details" && selectedSlot ? (
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Enter your details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Almost done — confirm your booking below.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 shrink-0 px-2 text-xs"
                  onClick={() => {
                    setStep("time")
                    setError(null)
                  }}
                >
                  <ArrowLeft className="mr-1 size-3.5" />
                  Back
                </Button>
              </div>

              <div
                className="space-y-2 rounded-xl border p-4 text-sm"
                style={{ borderColor: `${accentColor}33`, backgroundColor: `${accentColor}08` }}
              >
                <p className="font-semibold">{formatSlotDateTimeLabel(selectedSlot.startAt, displayTimezone)}</p>
                <p className="text-muted-foreground">{formatTimezoneLabel(displayTimezone)}</p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Location:</span> {page.locationLabel}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="booking-name">Name</Label>
                  <Input id="booking-name" className="h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="booking-email">Email</Label>
                  <Input
                    id="booking-email"
                    type="email"
                    className="h-11"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="booking-company">Company</Label>
                  <Input id="booking-company" className="h-11" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="booking-phone">Phone (optional)</Label>
                  <Input id="booking-phone" className="h-11" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="booking-notes">Notes (optional)</Label>
                  <Textarea id="booking-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button
                type="button"
                className="h-11 w-full text-base font-semibold text-white"
                disabled={submitting || !form.name.trim() || !form.email.trim()}
                style={{ backgroundColor: accentColor }}
                onClick={() => void submitBooking()}
              >
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Confirm Booking
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
