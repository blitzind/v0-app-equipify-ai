"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, ExternalLink, Link2, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_INNER_GAP,
  GrowthSettingsBadge,
  GrowthSettingsCard,
  GrowthSettingsToggleRow,
} from "@/components/growth/growth-settings-ui"
import type { GrowthBookingPageListItem } from "@/lib/growth/booking/booking-page-types"
import { GROWTH_BOOKING_PAGES_QA_MARKER } from "@/lib/growth/booking/booking-page-types"
import {
  GROWTH_BOOKING_MEETING_PROVIDER_OVERRIDE_LABELS,
  GROWTH_BOOKING_MEETING_PROVIDER_OVERRIDES,
  GROWTH_MEETING_LOCATION_HELPER_COPY,
  legacyBookingLocationToProvider,
  meetingLocationNeedsLocationLabel,
  meetingLocationNeedsManualUrl,
  type GrowthBookingMeetingProviderOverride,
  type GrowthMeetingLocationProvider,
} from "@/lib/growth/meeting-location/meeting-location-provider-types"

const DEFAULT_FORM = {
  name: "",
  slug: "",
  description: "",
  brandColor: "#059669",
  durationMinutes: "30",
  bufferMinutes: "0",
  timezone: "America/New_York",
  meetingType: "Intro call",
  confirmationMessage: "Thanks — your meeting is confirmed.",
  enabled: false,
  meetingProviderOverride: "inherit" as GrowthBookingMeetingProviderOverride,
}

function effectiveBookingProvider(page: GrowthBookingPageListItem): GrowthMeetingLocationProvider {
  if (page.meetingProviderOverride !== "inherit") return page.meetingProviderOverride
  return legacyBookingLocationToProvider(page.locationType)
}

export function GrowthBookingPagesPanel() {
  const [pages, setPages] = useState<GrowthBookingPageListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [message, setMessage] = useState<string | null>(null)

  const selected = pages.find((page) => page.id === selectedId) ?? null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/booking-pages", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; pages?: GrowthBookingPageListItem[] }
      if (res.ok && data.ok) setPages(data.pages ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createPage() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/booking-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || undefined,
          description: form.description || null,
          brandColor: form.brandColor,
          durationMinutes: Number(form.durationMinutes),
          bufferMinutes: Number(form.bufferMinutes),
          timezone: form.timezone,
          meetingType: form.meetingType,
          confirmationMessage: form.confirmationMessage,
          enabled: form.enabled,
          meetingProviderOverride: form.meetingProviderOverride,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; page?: GrowthBookingPageListItem; message?: string }
      if (!res.ok || !data.ok || !data.page) throw new Error(data.message ?? "Could not create booking page.")
      setMessage("Booking page created.")
      setForm(DEFAULT_FORM)
      setSelectedId(data.page.id)
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not create booking page.")
    } finally {
      setSaving(false)
    }
  }

  async function updatePage(patch: Record<string, unknown>) {
    if (!selected) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/booking-pages/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not update booking page.")
      setMessage("Booking page updated.")
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not update booking page.")
    } finally {
      setSaving(false)
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setMessage("Booking link copied.")
    } catch {
      setMessage("Could not copy link.")
    }
  }

  return (
    <GrowthSettingsCard
      title="Booking Pages"
      icon={<Link2 className="size-4" />}
      headerAside={<GrowthSettingsBadge label={GROWTH_BOOKING_PAGES_QA_MARKER} tone="neutral" />}
    >
      <div className={GROWTH_SETTINGS_INNER_GAP}>
        <p className="text-xs text-muted-foreground">
          Calendly-style public booking links. Enabled pages only are visible at `/book/[slug]`.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading booking pages…
          </div>
        ) : (
          <>
            <div className="grid gap-2 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="space-y-1 rounded-md border border-border/70 p-2 dark:border-[#25324C]">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium">Pages</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => {
                      setSelectedId(null)
                      setForm(DEFAULT_FORM)
                    }}
                  >
                    <Plus className="mr-1 size-3" />
                    New
                  </Button>
                </div>
                {pages.length === 0 ? (
                  <p className="px-1 py-2 text-[11px] text-muted-foreground">No booking pages yet.</p>
                ) : (
                  pages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      className={`flex w-full flex-col rounded px-2 py-1.5 text-left text-xs ${
                        selectedId === page.id ? "bg-muted" : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedId(page.id)}
                    >
                      <span className="font-medium">{page.name}</span>
                      <span className="text-muted-foreground">
                        /book/{page.slug} · {page.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </button>
                  ))
                )}
              </div>

              <div className="space-y-3 rounded-md border border-border/70 p-3 dark:border-[#25324C]">
                {selected ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <GrowthSettingsBadge label={selected.enabled ? "Enabled" : "Disabled"} tone={selected.enabled ? "healthy" : "neutral"} />
                      <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                        <a href={selected.bookingLink} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 size-3" />
                          Preview
                        </a>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => void copyLink(selected.bookingLink)}
                      >
                        <Copy className="mr-1 size-3" />
                        Copy Link
                      </Button>
                    </div>
                    <GrowthSettingsToggleRow
                      label="Enable booking page"
                      checked={selected.enabled}
                      onCheckedChange={(enabled) => void updatePage({ enabled })}
                      disabled={saving}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Name</Label>
                        <Input className="h-9" defaultValue={selected.name} onBlur={(e) => void updatePage({ name: e.target.value })} />
                      </div>
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Slug</Label>
                        <Input className="h-9" defaultValue={selected.slug} onBlur={(e) => void updatePage({ slug: e.target.value })} />
                      </div>
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Duration (minutes)</Label>
                        <Input
                          className="h-9"
                          defaultValue={String(selected.durationMinutes)}
                          onBlur={(e) => void updatePage({ durationMinutes: Number(e.target.value) })}
                        />
                      </div>
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Buffer (minutes)</Label>
                        <Input
                          className="h-9"
                          defaultValue={String(selected.bufferMinutes)}
                          onBlur={(e) => void updatePage({ bufferMinutes: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Description</Label>
                      <Textarea
                        rows={2}
                        defaultValue={selected.description ?? ""}
                        onBlur={(e) => void updatePage({ description: e.target.value || null })}
                      />
                    </div>
                    <div className="space-y-2 rounded-md border border-border/70 p-2.5 dark:border-[#25324C]">
                      <p className="text-xs font-medium">Meeting location</p>
                      <p className="text-[11px] text-muted-foreground">{GROWTH_MEETING_LOCATION_HELPER_COPY}</p>
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Meeting provider override</Label>
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                          value={selected.meetingProviderOverride}
                          onChange={(event) =>
                            void updatePage({
                              meetingProviderOverride: event.target.value as GrowthBookingMeetingProviderOverride,
                            })
                          }
                          disabled={saving}
                        >
                          {GROWTH_BOOKING_MEETING_PROVIDER_OVERRIDES.map((option) => (
                            <option key={option} value={option}>
                              {GROWTH_BOOKING_MEETING_PROVIDER_OVERRIDE_LABELS[option]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Auto-create meeting link</Label>
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                          value={
                            selected.autoCreateMeetingLinkOverride === null
                              ? "inherit"
                              : selected.autoCreateMeetingLinkOverride
                                ? "on"
                                : "off"
                          }
                          onChange={(event) => {
                            const value = event.target.value
                            void updatePage({
                              autoCreateMeetingLinkOverride:
                                value === "inherit" ? null : value === "on",
                            })
                          }}
                          disabled={saving}
                        >
                          <option value="inherit">Inherit platform default</option>
                          <option value="on">On</option>
                          <option value="off">Off</option>
                        </select>
                      </div>
                      {meetingLocationNeedsManualUrl(effectiveBookingProvider(selected)) ? (
                        <div className={GROWTH_SETTINGS_FORM_GAP}>
                          <Label className="text-xs">Manual meeting URL</Label>
                          <Input
                            className="h-9"
                            defaultValue={selected.manualMeetingUrl ?? ""}
                            placeholder="https://zoom.us/j/… or Teams link"
                            onBlur={(e) => void updatePage({ manualMeetingUrl: e.target.value.trim() || null })}
                          />
                        </div>
                      ) : null}
                      {meetingLocationNeedsLocationLabel(effectiveBookingProvider(selected)) ? (
                        <div className={GROWTH_SETTINGS_FORM_GAP}>
                          <Label className="text-xs">Phone number or location text</Label>
                          <Input
                            className="h-9"
                            defaultValue={selected.customLocation ?? ""}
                            placeholder="Phone number, address, or call notes"
                            onBlur={(e) => void updatePage({ customLocation: e.target.value.trim() || null })}
                          />
                        </div>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Recent bookings: {selected.recentBookingsCount}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium">Create Booking Page</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Calendar name</Label>
                        <Input className="h-9" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      </div>
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Custom slug</Label>
                        <Input className="h-9" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                      </div>
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Duration (minutes)</Label>
                        <Input
                          className="h-9"
                          value={form.durationMinutes}
                          onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                        />
                      </div>
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Timezone</Label>
                        <Input className="h-9" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
                      </div>
                    </div>
                    <GrowthSettingsToggleRow
                      label="Enable after create"
                      checked={form.enabled}
                      onCheckedChange={(enabled) => setForm({ ...form, enabled })}
                    />
                    <Button type="button" size="sm" disabled={saving || !form.name.trim()} onClick={() => void createPage()}>
                      {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                      Create Booking Page
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </div>
    </GrowthSettingsCard>
  )
}
