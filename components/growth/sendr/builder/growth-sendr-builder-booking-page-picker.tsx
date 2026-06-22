"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CalendarDays, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { GrowthSendrBuilderEmptyState } from "@/components/growth/sendr/builder/growth-sendr-builder-empty-state"

type BookingPageItem = {
  id: string
  name: string
  slug: string
  pageTitle: string | null
  durationMinutes: number
  enabled: boolean
  bookingLink: string
}

type Props = {
  pageId: string
  meetingLink: string
  meetingType: string
  durationMinutes: string
  timezone: string
  disabled?: boolean
  onMeetingLinkChange: (value: string) => void
  onMeetingTypeChange: (value: string) => void
  onDurationChange: (value: string) => void
  onTimezoneChange: (value: string) => void
  onAttached: () => void
  onMessage: (message: string | null) => void
}

export function GrowthSendrBuilderBookingPagePicker({
  pageId,
  meetingLink,
  meetingType,
  durationMinutes,
  timezone,
  disabled,
  onMeetingLinkChange,
  onMeetingTypeChange,
  onDurationChange,
  onTimezoneChange,
  onAttached,
  onMessage,
}: Props) {
  const [pages, setPages] = useState<BookingPageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)

  const loadPages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/booking-pages", { cache: "no-store" })
      const data = (await res.json()) as { ok?: boolean; pages?: BookingPageItem[] }
      setPages(data.pages ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPages()
  }, [loadPages])

  async function attachSelectedBookingPage(page: BookingPageItem) {
    setBusy(true)
    onMessage(null)
    try {
      onMeetingLinkChange(page.bookingLink)
      onMeetingTypeChange(page.pageTitle ?? page.name)
      onDurationChange(String(page.durationMinutes))
      const regRes = await fetch("/api/platform/growth/sendr/booking-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          meetingLink: page.bookingLink,
          meetingType: page.pageTitle ?? page.name,
          durationMinutes: page.durationMinutes,
          timezone,
          calendarProvider: "manual",
          legacyBookingPageId: page.id,
        }),
      })
      const regData = (await regRes.json()) as { ok: boolean; bookingAsset?: { id: string }; message?: string }
      if (!regRes.ok || !regData.bookingAsset?.id) {
        onMessage(regData.message ?? "Booking attach failed")
        return
      }
      const attachRes = await fetch("/api/platform/growth/sendr/booking-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attach",
          landingPageId: pageId,
          bookingAssetId: regData.bookingAsset.id,
        }),
      })
      const attachData = (await attachRes.json()) as { ok: boolean; message?: string }
      if (!attachRes.ok) {
        onMessage(attachData.message ?? "Booking attach failed")
        return
      }
      setSelectedPageId(page.id)
      onMessage(`Connected booking page “${page.name}”`)
      onAttached()
    } finally {
      setBusy(false)
    }
  }

  async function registerManualLink() {
    setBusy(true)
    onMessage(null)
    try {
      const regRes = await fetch("/api/platform/growth/sendr/booking-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          meetingLink: meetingLink || null,
          meetingType,
          durationMinutes: Number(durationMinutes) || 30,
          timezone,
          calendarProvider: "manual",
        }),
      })
      const regData = (await regRes.json()) as { ok: boolean; bookingAsset?: { id: string }; message?: string }
      if (!regRes.ok || !regData.bookingAsset?.id) {
        onMessage(regData.message ?? "Booking register failed")
        return
      }
      const attachRes = await fetch("/api/platform/growth/sendr/booking-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attach",
          landingPageId: pageId,
          bookingAssetId: regData.bookingAsset.id,
        }),
      })
      const attachData = (await attachRes.json()) as { ok: boolean; message?: string }
      if (!attachRes.ok) {
        onMessage(attachData.message ?? "Booking attach failed")
        return
      }
      onMessage("Booking link attached")
      onAttached()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Select existing booking page (optional)</Label>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading booking pages…
          </p>
        ) : pages.length === 0 ? (
          <GrowthSendrBuilderEmptyState
            icon={CalendarDays}
            title="No booking pages yet"
            description="Create a booking page in Growth Booking, or paste a calendar URL manually below."
            compact
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href="/admin/growth/settings/communications">Create booking page</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                disabled={disabled || busy}
                onClick={() => void attachSelectedBookingPage(page)}
                className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-4 text-left transition hover:border-blue-500/40 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{page.pageTitle ?? page.name}</p>
                    <Badge variant={page.enabled ? "default" : "secondary"}>
                      {page.enabled ? "Active" : "Disabled"}
                    </Badge>
                    {selectedPageId === page.id ? <Badge variant="outline">Selected</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {page.durationMinutes} min · /book/{page.slug}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{page.bookingLink}</p>
                </div>
                <ExternalLink className="mt-1 size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-dashed border-slate-200/80 p-4 dark:border-slate-800">
        <p className="text-sm font-medium">Or paste a calendar URL manually</p>
        <div className="space-y-2">
          <Label>Meeting link (optional)</Label>
          <Input value={meetingLink} disabled={disabled || busy} onChange={(e) => onMeetingLinkChange(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Meeting type</Label>
          <Input value={meetingType} disabled={disabled || busy} onChange={(e) => onMeetingTypeChange(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Duration (minutes)</Label>
            <Input value={durationMinutes} disabled={disabled || busy} onChange={(e) => onDurationChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input value={timezone} disabled={disabled || busy} onChange={(e) => onTimezoneChange(e.target.value)} />
          </div>
        </div>
        <Button disabled={disabled || busy} onClick={() => void registerManualLink()}>
          {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
          Save booking link
        </Button>
      </div>
    </div>
  )
}
