"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CalendarDays, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

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
  bookingPageId: string
  calendarUrl: string
  disabled?: boolean
  onBookingPageIdChange: (value: string) => void
  onCalendarUrlChange: (value: string) => void
}

export function GrowthSharePageBookingPagePicker({
  bookingPageId,
  calendarUrl,
  disabled,
  onBookingPageIdChange,
  onCalendarUrlChange,
}: Props) {
  const [pages, setPages] = useState<BookingPageItem[]>([])
  const [loading, setLoading] = useState(true)

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

  function selectPage(page: BookingPageItem) {
    onBookingPageIdChange(page.id)
    onCalendarUrlChange(page.bookingLink)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Select existing booking page (optional)</Label>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading booking pages…
          </p>
        ) : pages.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <p>No booking pages yet. Create one in Growth settings, or paste a calendar URL below.</p>
            <Button size="sm" variant="outline" className="mt-3" asChild>
              <Link href="/admin/growth/settings/communications">Create booking page</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                disabled={disabled}
                onClick={() => selectPage(page)}
                className="flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{page.pageTitle ?? page.name}</p>
                    <Badge variant={page.enabled ? "default" : "secondary"}>
                      {page.enabled ? "Active" : "Disabled"}
                    </Badge>
                    {bookingPageId === page.id ? <Badge variant="outline">Selected</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {page.durationMinutes} min · /book/{page.slug}
                  </p>
                </div>
                <ExternalLink className="mt-1 size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-dashed p-4">
        <Label htmlFor="calendarUrlManual">Or paste calendar URL manually</Label>
        <Input
          id="calendarUrlManual"
          value={calendarUrl}
          disabled={disabled}
          onChange={(e) => onCalendarUrlChange(e.target.value)}
          inputMode="url"
          placeholder="https://"
        />
        {bookingPageId ? (
          <p className="text-xs text-muted-foreground">
            <CalendarDays className="mr-1 inline size-3.5" />
            Booking page reference saved — public CTA uses attributed booking link when published.
          </p>
        ) : null}
      </div>
    </div>
  )
}
