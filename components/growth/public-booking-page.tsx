"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { ArrowLeft, CalendarDays, Loader2, Shield, Sparkles, Users, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PublicBookingBrandPanel } from "@/components/growth/public-booking/public-booking-brand-panel"
import { PublicBookingCalendar } from "@/components/growth/public-booking/public-booking-calendar"
import { BookingSummaryCard, FloatingInput, FloatingTextarea } from "@/components/growth/public-booking/public-booking-form-fields"
import { PublicBookingStepProgress, type BookingStep } from "@/components/growth/public-booking/public-booking-step-progress"
import { PublicBookingSuccess } from "@/components/growth/public-booking/public-booking-success"
import { PublicBookingTimezoneSelect } from "@/components/growth/public-booking/public-booking-timezone-select"
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
import { formatTimezoneLabel, resolveVisitorTimezone } from "@/lib/growth/booking/booking-public-timezone"
import type { GrowthBookingPagePublicView, GrowthBookingSlot } from "@/lib/growth/booking/booking-page-types"
import { cn } from "@/lib/utils"

type BookingPageProps = {
  slug: string
}

type BookingSuccessState = {
  message: string
  slotStartAt: string
  slotEndAt: string
  meetingUrl: string | null
  locationLabel: string | null
  locationUrl: string | null
}

function BookingLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-100/80 px-4 py-8 dark:bg-slate-950 sm:py-12">
      <div className="mx-auto max-w-[1440px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="grid lg:grid-cols-[38%_62%]">
          <div className="hidden min-h-[640px] animate-pulse bg-slate-900 lg:block" />
          <div className="space-y-6 p-8 sm:p-10">
            <div className="flex gap-4">
              <div className="size-10 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-10 flex-1 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="size-10 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            <div className="h-[420px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60" />
          </div>
        </div>
      </div>
    </div>
  )
}

function TrustFeatureRow() {
  const items = [
    { icon: Shield, label: "No commitment" },
    { icon: Users, label: "Personalized demo" },
    { icon: Zap, label: "Real solutions" },
  ]

  return (
    <div className="mt-auto grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3 dark:border-slate-800">
      {items.map(({ icon: Icon, label }) => (
        <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-4 shrink-0 text-slate-400" />
          {label}
        </div>
      ))}
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

  function handleTimezoneChange(value: string) {
    setDisplayTimezone(value)
    if (selectedDateKey && !groupSlotsByDateKey(slots, value).has(selectedDateKey)) {
      setSelectedDateKey(null)
      setSelectedSlot(null)
      setStep("date")
    }
  }

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

  function resetBookingFlow() {
    setSuccess(null)
    setStep("date")
    setSelectedDateKey(null)
    setSelectedSlot(null)
    setForm({ name: "", email: "", company: "", phone: "", notes: "" })
    setError(null)
  }

  if (loading) return <BookingLoadingSkeleton />

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100/80 px-6 text-center dark:bg-slate-950">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold">Booking page unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error ?? "This booking link is disabled or does not exist."}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <PublicBookingSuccess
        accentColor={accentColor}
        pageTitle={page.pageTitle}
        message={success.message}
        slotStartAt={success.slotStartAt}
        slotEndAt={success.slotEndAt}
        displayTimezone={displayTimezone}
        locationLabel={success.locationLabel}
        meetingUrl={success.meetingUrl}
        locationUrl={success.locationUrl}
        onBookAnother={resetBookingFlow}
      />
    )
  }

  return (
    <div
      className="min-h-screen bg-slate-100/80 px-3 py-6 dark:bg-slate-950 sm:px-6 sm:py-10"
      data-qa-marker={GROWTH_BOOKING_PAGE_UI_QA_MARKER}
    >
      <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgb(0,0,0,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgb(0,0,0,0.45)]">
        <div className="grid lg:grid-cols-[38%_62%]">
          <aside className="border-b border-slate-200/80 lg:border-b-0 lg:border-r dark:border-slate-800">
            <PublicBookingBrandPanel page={page} displayTimezone={displayTimezone} pageTimezone={pageTimezone} />
          </aside>

          <section className="flex min-h-[36rem] flex-col p-6 sm:p-8 lg:min-h-[720px] lg:p-10 xl:p-12">
            <PublicBookingStepProgress step={step} accentColor={accentColor} />

            {step === "date" ? (
              <div
                className={cn(
                  "flex flex-1 flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300",
                )}
              >
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">Select a date</h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">Choose a day that works best for you.</p>
                  </div>
                  <PublicBookingTimezoneSelect
                    compact
                    displayTimezone={displayTimezone}
                    pageTimezone={pageTimezone}
                    visitorTimezone={visitorTimezone}
                    onChange={handleTimezoneChange}
                    className="sm:shrink-0"
                  />
                </div>

                <div className="flex flex-1 flex-col gap-6 xl:flex-row xl:items-start">
                  <div className="w-full xl:max-w-[680px] xl:flex-1">
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

                  <div className="hidden flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center dark:border-slate-800 dark:bg-slate-950/40 xl:flex">
                    <div
                      className="flex size-16 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
                    >
                      <CalendarDays className="size-8" />
                    </div>
                    <p className="mt-4 text-base font-semibold">Pick a date</p>
                    <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                      Select an available date to see open times in your local timezone.
                    </p>
                  </div>
                </div>

                <TrustFeatureRow />
              </div>
            ) : null}

            {step === "time" ? (
              <div
                className={cn(
                  "mx-auto flex w-full max-w-2xl flex-1 flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300",
                )}
              >
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Select a time</h2>
                    <p className="mt-1.5 text-sm font-medium text-foreground">
                      {selectedDateKey ? formatDateKeyLabel(selectedDateKey, displayTimezone) : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Times shown in your local timezone</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 shrink-0 rounded-xl px-3 text-sm font-medium"
                    style={{ color: accentColor }}
                    onClick={() => {
                      setStep("date")
                      setSelectedSlot(null)
                      setError(null)
                    }}
                  >
                    <ArrowLeft className="mr-2 size-4" />
                    Change date
                  </Button>
                </div>

                <PublicBookingTimezoneSelect
                  displayTimezone={displayTimezone}
                  pageTimezone={pageTimezone}
                  visitorTimezone={visitorTimezone}
                  onChange={handleTimezoneChange}
                />

                {selectedDaySlots.length === 0 ? (
                  <p className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-muted-foreground dark:border-slate-800">
                    No available times this day. Pick another date.
                  </p>
                ) : (
                  <div
                    className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
                    style={{ "--booking-accent": accentColor } as CSSProperties}
                  >
                    {selectedDaySlots.map((slot) => (
                      <Button
                        key={slot.startAt}
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-[52px] justify-center rounded-xl text-sm font-semibold transition-all duration-200",
                          "border-[color-mix(in_srgb,var(--booking-accent)_35%,transparent)] bg-white text-[var(--booking-accent)]",
                          "hover:-translate-y-0.5 hover:border-[var(--booking-accent)] hover:bg-[var(--booking-accent)] hover:text-white hover:shadow-lg",
                          "motion-reduce:hover:translate-y-0 dark:bg-slate-900",
                        )}
                        onClick={() => {
                          setSelectedSlot(slot)
                          setError(null)
                          setStep("details")
                        }}
                      >
                        {formatSlotTimeLabel(slot.startAt, displayTimezone)}
                      </Button>
                    ))}
                  </div>
                )}

                <TrustFeatureRow />
              </div>
            ) : null}

            {step === "details" && selectedSlot ? (
              <div
                className={cn(
                  "mx-auto flex w-full max-w-xl flex-1 flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300",
                )}
              >
                <div className="mb-6 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Your details</h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">Almost done — review and schedule your demo.</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 shrink-0 rounded-xl px-3 text-sm"
                    onClick={() => {
                      setStep("time")
                      setError(null)
                    }}
                  >
                    <ArrowLeft className="mr-2 size-4" />
                    Back
                  </Button>
                </div>

                <BookingSummaryCard accentColor={accentColor}>
                  <p className="font-semibold text-foreground">{formatSlotDateTimeLabel(selectedSlot.startAt, displayTimezone)}</p>
                  <p className="text-muted-foreground">{formatTimezoneLabel(displayTimezone)}</p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Duration:</span> {page.durationMinutes} minutes
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Location:</span> {page.locationLabel}
                  </p>
                </BookingSummaryCard>

                <div className="mt-6 space-y-4">
                  <FloatingInput
                    id="booking-name"
                    label="Full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoComplete="name"
                  />
                  <FloatingInput
                    id="booking-email"
                    label="Work email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    autoComplete="email"
                  />
                  <FloatingInput
                    id="booking-company"
                    label="Company"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    autoComplete="organization"
                  />
                  <FloatingInput
                    id="booking-phone"
                    label="Phone (optional)"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    autoComplete="tel"
                  />
                  <FloatingTextarea
                    id="booking-notes"
                    label="Notes (optional)"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>

                {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

                <Button
                  type="button"
                  className="mt-8 h-14 w-full rounded-xl text-base font-semibold text-white shadow-lg transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
                  disabled={submitting || !form.name.trim() || !form.email.trim()}
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 80%, #4338ca))`,
                    boxShadow: `0 12px 32px ${accentColor}44`,
                  }}
                  onClick={() => void submitBooking()}
                >
                  {submitting ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Sparkles className="mr-2 size-5" />}
                  Schedule Demo
                </Button>

                <TrustFeatureRow />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}
