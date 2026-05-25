"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Loader2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import type { GrowthBookingPagePublicView, GrowthBookingSlot } from "@/lib/growth/booking/booking-page-types"

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

function EventDetailsPanel({ page, timezone }: { page: GrowthBookingPagePublicView; timezone: string }) {
  return (
    <div className="space-y-4">
      {page.heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.heroImageUrl} alt="" className="h-32 w-full rounded-xl object-cover" />
      ) : null}
      {page.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={page.logoUrl} alt="" className="h-10 w-auto object-contain" />
      ) : null}
      {page.brandName ? (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{page.brandName}</p>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground" style={{ color: page.brandColor }}>
          {page.pageTitle}
        </h1>
        {page.description ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{page.description}</p> : null}
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex items-start gap-2 text-muted-foreground">
          <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <dd>{page.durationMinutes} minutes</dd>
        </div>
        <div className="flex items-start gap-2 text-muted-foreground">
          <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden />
          <dd>{timezone.replace(/_/g, " ")}</dd>
        </div>
        <div className="flex items-start gap-2 text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          <dd>{page.locationLabel}</dd>
        </div>
      </dl>
      {page.footerNote ? <p className="text-xs text-muted-foreground">{page.footerNote}</p> : null}
    </div>
  )
}

export default function PublicBookingPage({ slug }: BookingPageProps) {
  const [page, setPage] = useState<GrowthBookingPagePublicView | null>(null)
  const [slots, setSlots] = useState<GrowthBookingSlot[]>([])
  const [timezone, setTimezone] = useState("UTC")
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
      setPage(pageData.page)
      setSlots(slotsData.slots ?? [])
      setTimezone(slotsData.timezone ?? pageData.page.timezone)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking page unavailable.")
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  const slotsByDate = useMemo(() => groupSlotsByDateKey(slots, timezone), [slots, timezone])
  const availableDateKeys = useMemo(() => datesWithAvailableSlots(slots, timezone), [slots, timezone])
  const todayKey = useMemo(() => calendarDateToSlotKey(new Date(), timezone), [timezone])
  const selectedDaySlots = selectedDateKey ? slotsByDate.get(selectedDateKey) ?? [] : []
  const accentColor = page?.accentColor ?? page?.brandColor ?? "#2563eb"
  const selectedCalendarDate = selectedDateKey ? parseDateKey(selectedDateKey) : undefined
  const showDetailsForm = Boolean(selectedSlot)

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
        <div className="mx-auto max-w-lg rounded-2xl border border-border/70 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-8 text-emerald-600" aria-hidden />
            <div>
              <h1 className="text-xl font-semibold">You&apos;re scheduled</h1>
              <p className="text-sm text-muted-foreground">{success.message}</p>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-border/60 bg-slate-50/80 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/50">
            <p className="font-medium">{formatSlotDateTimeLabel(success.slotStartAt, timezone)}</p>
            <p className="mt-1 text-muted-foreground">{timezone.replace(/_/g, " ")}</p>
            {success.locationLabel ? (
              <p className="mt-3 text-muted-foreground">
                <span className="font-medium text-foreground">Location:</span> {success.locationLabel}
              </p>
            ) : null}
            {success.meetingUrl || success.locationUrl ? (
              <a
                href={success.meetingUrl ?? success.locationUrl ?? "#"}
                className="mt-3 inline-flex text-sm font-medium underline-offset-4 hover:underline"
                style={{ color: accentColor }}
                target="_blank"
                rel="noreferrer"
              >
                Open meeting link
              </a>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">A calendar invitation will be sent to your email.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 sm:py-10" data-qa-marker={GROWTH_BOOKING_PAGE_UI_QA_MARKER}>
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border/70 lg:bg-white lg:shadow-sm dark:lg:border-slate-800 dark:lg:bg-slate-900">
        <aside className="lg:border-r lg:border-border/70 lg:p-8 dark:lg:border-slate-800">
          <EventDetailsPanel page={page} timezone={timezone} />
        </aside>

        <section className="rounded-2xl border border-border/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:rounded-none lg:border-0 lg:p-8 lg:shadow-none">
          {!showDetailsForm ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Select a date & time</h2>
                <p className="text-sm text-muted-foreground">{timezone.replace(/_/g, " ")}</p>
              </div>

              <Calendar
                mode="single"
                month={visibleMonth}
                onMonthChange={setVisibleMonth}
                selected={selectedCalendarDate}
                onSelect={(date) => {
                  if (!date) return
                  setSelectedDateKey(calendarDateToSlotKey(date, timezone))
                  setSelectedSlot(null)
                  setError(null)
                }}
                disabled={(date) => {
                  const key = calendarDateToSlotKey(date, timezone)
                  return key < todayKey || !availableDateKeys.has(key)
                }}
                modifiers={{
                  available: (date) => availableDateKeys.has(calendarDateToSlotKey(date, timezone)),
                }}
                modifiersClassNames={{
                  available:
                    "after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-emerald-500",
                }}
                className="mx-auto rounded-xl border border-border/60 p-2 dark:border-slate-800"
              />

              {selectedDateKey ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">{formatDateKeyLabel(selectedDateKey, timezone)}</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        setSelectedDateKey(null)
                        setSelectedSlot(null)
                      }}
                    >
                      Change date
                    </Button>
                  </div>
                  {selectedDaySlots.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground dark:border-slate-800">
                      No available times this day. Pick another date.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                      {selectedDaySlots.map((slot) => (
                        <Button
                          key={slot.startAt}
                          type="button"
                          variant="outline"
                          className="h-10 justify-center text-sm font-medium hover:border-transparent hover:text-white"
                          style={{ borderColor: accentColor, color: accentColor }}
                          onClick={() => {
                            setSelectedSlot(slot)
                            setError(null)
                          }}
                        >
                          {formatSlotTimeLabel(slot.startAt, timezone)}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Choose a highlighted date to see available times.</p>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Enter your details</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatSlotDateTimeLabel(selectedSlot!.startAt, timezone)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setSelectedSlot(null)}
                >
                  <ArrowLeft className="mr-1 size-3" />
                  Back
                </Button>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="booking-name">Name</Label>
                  <Input id="booking-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="booking-email">Email</Label>
                  <Input id="booking-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="booking-company">Company</Label>
                  <Input id="booking-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="booking-phone">Phone (optional)</Label>
                  <Input id="booking-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="booking-notes">Notes (optional)</Label>
                  <Textarea id="booking-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button
                type="button"
                className="w-full text-white"
                disabled={submitting || !form.name.trim() || !form.email.trim()}
                style={{ backgroundColor: accentColor }}
                onClick={() => void submitBooking()}
              >
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Confirm Booking
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
