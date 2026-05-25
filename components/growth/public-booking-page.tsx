"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { GrowthBookingPagePublicView, GrowthBookingSlot } from "@/lib/growth/booking/booking-page-types"

type BookingPageProps = {
  slug: string
}

export default function PublicBookingPage({ slug }: BookingPageProps) {
  const [page, setPage] = useState<GrowthBookingPagePublicView | null>(null)
  const [slots, setSlots] = useState<GrowthBookingSlot[]>([])
  const [timezone, setTimezone] = useState("UTC")
  const [selectedSlot, setSelectedSlot] = useState<GrowthBookingSlot | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
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

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, GrowthBookingSlot[]>()
    for (const slot of slots) {
      const key = new Date(slot.startAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
      const list = groups.get(key) ?? []
      list.push(slot)
      groups.set(key, list)
    }
    return [...groups.entries()]
  }, [slots])

  async function submitBooking() {
    if (!selectedSlot) return
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
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Booking failed.")
      setSuccess(data.confirmationMessage ?? "Your meeting is confirmed.")
      if (data.meetingUrl) setSuccess((prev) => `${prev ?? ""} Meet link: ${data.meetingUrl}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading booking page…
      </div>
    )
  }

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <h1 className="text-lg font-semibold">Booking page unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error ?? "This booking link is disabled or does not exist."}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-lg rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold" style={{ color: page.brandColor }}>
            {page.name}
          </h1>
          <p className="mt-3 text-sm text-foreground">{success}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-10">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4">
            {page.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.logoUrl} alt="" className="mb-3 h-10 w-auto object-contain" />
            ) : null}
            <h1 className="text-2xl font-semibold" style={{ color: page.brandColor }}>
              {page.name}
            </h1>
            {page.description ? <p className="mt-2 text-sm text-muted-foreground">{page.description}</p> : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {page.durationMinutes} min · {timezone.replace(/_/g, " ")}
            </p>
          </div>

          <div className="space-y-4">
            {groupedSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No available times in the next two weeks.</p>
            ) : (
              groupedSlots.map(([day, daySlots]) => (
                <div key={day}>
                  <p className="mb-2 text-sm font-medium">{day}</p>
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map((slot) => {
                      const active = selectedSlot?.startAt === slot.startAt
                      return (
                        <Button
                          key={slot.startAt}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          className="h-8 px-3 text-xs"
                          style={active ? { backgroundColor: page.brandColor, borderColor: page.brandColor } : undefined}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          {new Date(slot.startAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Your details</h2>
          <div className="mt-3 space-y-3">
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
            {selectedSlot ? (
              <p className="text-xs text-muted-foreground">
                Selected: {new Date(selectedSlot.startAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Select a time to continue.</p>
            )}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <Button
              type="button"
              className="w-full"
              disabled={submitting || !selectedSlot || !form.name.trim() || !form.email.trim()}
              style={{ backgroundColor: page.brandColor }}
              onClick={() => void submitBooking()}
            >
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Confirm Booking
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
