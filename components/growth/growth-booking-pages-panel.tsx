"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, ExternalLink, Link2, Loader2, Plus, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBookingAvailabilityEditor } from "@/components/growth/growth-booking-availability-editor"
import { GrowthIanaTimezoneSelect } from "@/components/growth/growth-iana-timezone-select"
import {
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_INNER_GAP,
  GrowthSettingsBadge,
  GrowthSettingsCard,
  GrowthSettingsToggleRow,
} from "@/components/growth/growth-settings-ui"
import type { GrowthBookingPageListItem } from "@/lib/growth/booking/booking-page-types"
import {
  GROWTH_BOOKING_PUBLIC_THEME_MODE_LABELS,
  GROWTH_BOOKING_PUBLIC_THEME_MODES,
  GROWTH_BOOKING_TIMEZONE_MODES,
} from "@/lib/growth/booking/booking-page-types"
import { growthBookingPageToEditorState } from "@/lib/growth/booking/booking-page-editor-state"
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
import {
  formatIanaTimezoneOption,
  resolveBookingTimezone,
} from "@/lib/growth/booking/booking-timezone-utils"
import { GrowthMediaPicker } from "@/components/growth/media-library/growth-media-picker"

import {
  weeklyScheduleToWindows,
  windowsToWeeklySchedule,
  type BookingWeeklyDaySchedule,
} from "@/lib/growth/booking/booking-page-ui-types"

const TIMEZONE_MODE_LABELS: Record<(typeof GROWTH_BOOKING_TIMEZONE_MODES)[number], string> = {
  fixed_host: "Fixed host timezone",
  visitor_local: "Visitor local timezone (recommended)",
  visitor_override: "Allow visitor override",
}

const HORIZON_PRESETS = ["30", "60", "90", "180", "365", "custom"] as const

const DEFAULT_FORM = {
  name: "",
  slug: "",
  pageTitle: "",
  brandName: "",
  description: "",
  logoUrl: "",
  heroImageUrl: "",
  brandColor: "#059669",
  accentColor: "#2563eb",
  footerNote: "",
  durationMinutes: "30",
  bufferMinutes: "0",
  bufferBeforeMinutes: "0",
  bufferAfterMinutes: "0",
  minimumNoticeHours: "0",
  schedulingHorizonPreset: "90",
  schedulingHorizonDays: "90",
  maxMeetingsPerDay: "",
  timezone: "America/New_York",
  timezoneMode: "visitor_local" as (typeof GROWTH_BOOKING_TIMEZONE_MODES)[number],
  publicThemeMode: "system" as (typeof GROWTH_BOOKING_PUBLIC_THEME_MODES)[number],
  meetingType: "Intro call",
  confirmationMessage: "Thanks — your meeting is confirmed.",
  enabled: false,
  meetingProviderOverride: "inherit" as GrowthBookingMeetingProviderOverride,
}

type EditorState = ReturnType<typeof growthBookingPageToEditorState> & {
  weeklySchedule: BookingWeeklyDaySchedule[]
}

function effectiveBookingProvider(
  meetingProviderOverride: GrowthBookingMeetingProviderOverride,
  locationType: string,
): GrowthMeetingLocationProvider {
  if (meetingProviderOverride !== "inherit") return meetingProviderOverride
  return legacyBookingLocationToProvider(locationType)
}

export function GrowthBookingPagesPanel({
  variant = "default",
}: {
  variant?: "default" | "operator"
}) {
  const isOperator = variant === "operator"
  const [pages, setPages] = useState<GrowthBookingPageListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [editor, setEditor] = useState<EditorState | null>(null)
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

  useEffect(() => {
    if (!selected) {
      setEditor(null)
      return
    }
    const base = growthBookingPageToEditorState(selected)
    setEditor({
      ...base,
      weeklySchedule: windowsToWeeklySchedule(selected.availabilityWindows),
    })
  }, [selected?.id, selected?.updatedAt])

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
          pageTitle: form.pageTitle || null,
          brandName: form.brandName || null,
          description: form.description || null,
          logoUrl: form.logoUrl || null,
          heroImageUrl: form.heroImageUrl || null,
          brandColor: form.brandColor,
          accentColor: form.accentColor,
          footerNote: form.footerNote || null,
          durationMinutes: Number(form.durationMinutes),
          bufferMinutes: Number(form.bufferMinutes),
          bufferBeforeMinutes: Number(form.bufferBeforeMinutes),
          bufferAfterMinutes: Number(form.bufferAfterMinutes),
          minimumNoticeHours: Number(form.minimumNoticeHours),
          schedulingHorizonDays:
            form.schedulingHorizonPreset === "custom"
              ? Number(form.schedulingHorizonDays)
              : Number(form.schedulingHorizonPreset),
          maxMeetingsPerDay: form.maxMeetingsPerDay ? Number(form.maxMeetingsPerDay) : null,
          timezone: form.timezone,
          timezoneMode: form.timezoneMode,
          publicThemeMode: form.publicThemeMode,
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

  async function saveEditor() {
    if (!selected || !editor) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/platform/growth/booking-pages/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editor.name,
          slug: editor.slug,
          pageTitle: editor.pageTitle || null,
          brandName: editor.brandName || null,
          description: editor.description || null,
          logoUrl: editor.logoUrl || null,
          heroImageUrl: editor.heroImageUrl || null,
          brandColor: editor.brandColor,
          accentColor: editor.accentColor || null,
          footerNote: editor.footerNote || null,
          meetingType: editor.meetingType || null,
          durationMinutes: Number(editor.durationMinutes),
          bufferMinutes: Number(editor.bufferMinutes),
          bufferBeforeMinutes: Number(editor.bufferBeforeMinutes),
          bufferAfterMinutes: Number(editor.bufferAfterMinutes),
          minimumNoticeHours: Number(editor.minimumNoticeHours),
          schedulingHorizonDays:
            editor.schedulingHorizonPreset === "custom"
              ? Number(editor.schedulingHorizonDays)
              : Number(editor.schedulingHorizonPreset),
          maxMeetingsPerDay: editor.maxMeetingsPerDay ? Number(editor.maxMeetingsPerDay) : null,
          timezone: editor.timezone,
          timezoneMode: editor.timezoneMode,
          publicThemeMode: editor.publicThemeMode,
          confirmationMessage: editor.confirmationMessage || null,
          enabled: editor.enabled,
          meetingProviderOverride: editor.meetingProviderOverride,
          autoCreateMeetingLinkOverride: editor.autoCreateMeetingLinkOverride,
          manualMeetingUrl: editor.manualMeetingUrl || null,
          customLocation: editor.customLocation || null,
          availabilityWindows: weeklyScheduleToWindows(editor.weeklySchedule),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not update booking page.")
      setMessage("Booking page saved.")
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not update booking page.")
    } finally {
      setSaving(false)
    }
  }

  function bookingPreviewHref(link: string, publicThemeMode: (typeof GROWTH_BOOKING_PUBLIC_THEME_MODES)[number]): string {
    const url = new URL(link, typeof window !== "undefined" ? window.location.origin : "https://example.com")
    url.searchParams.set("previewTheme", publicThemeMode)
    return `${url.pathname}${url.search}`
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setMessage("Booking link copied.")
    } catch {
      setMessage("Could not copy link.")
    }
  }

  const provider = editor
    ? effectiveBookingProvider(editor.meetingProviderOverride, selected?.locationType ?? "google_meet")
    : "google_meet"

  return (
    <GrowthSettingsCard
      title={isOperator ? "Booking pages" : "Booking Pages"}
      icon={<Link2 className="size-4" />}
    >
      <div className={GROWTH_SETTINGS_INNER_GAP}>
        <p className="text-sm text-muted-foreground">
          {isOperator
            ? "Share a public link so prospects can book time on your calendar. Published pages are live at /book/your-slug."
            : "Public booking links for your calendar. Enabled pages only are visible at `/book/[slug]`."}
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading booking pages…
          </div>
        ) : (
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
                <div className="rounded-lg border border-dashed border-border/70 px-2 py-3 text-center">
                  <p className="text-[11px] text-muted-foreground">No booking pages yet.</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Create one to start accepting meetings.</p>
                </div>
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
                      /book/{page.slug} · {page.enabled ? (isOperator ? "Published" : "Public") : "Draft"}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="space-y-3 rounded-md border border-border/70 p-3 dark:border-[#25324C]">
              {selected && editor ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthSettingsBadge
                      label={editor.enabled ? (isOperator ? "Published" : "Public link active") : "Draft"}
                      tone={editor.enabled ? "healthy" : "neutral"}
                    />
                    <GrowthSettingsBadge label={`${selected.recentBookingsCount} bookings`} tone="neutral" />
                    <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                      <a
                        href={bookingPreviewHref(selected.bookingLink, editor.publicThemeMode)}
                        target="_blank"
                        rel="noreferrer"
                      >
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
                    <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={saving} onClick={() => void saveEditor()}>
                      {saving ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Save className="mr-1 size-3" />}
                      Save
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground break-all">{selected.bookingLink}</p>

                  <GrowthSettingsToggleRow
                    label={isOperator ? "Publish booking page" : "Enable public booking page"}
                    checked={editor.enabled}
                    onCheckedChange={(enabled) => setEditor({ ...editor, enabled })}
                    disabled={saving}
                  />

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Internal name</Label>
                      <Input className="h-9" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Slug</Label>
                      <Input className="h-9" value={editor.slug} onChange={(e) => setEditor({ ...editor, slug: e.target.value })} />
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Public page title</Label>
                      <Input className="h-9" value={editor.pageTitle} onChange={(e) => setEditor({ ...editor, pageTitle: e.target.value })} />
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Brand / company name</Label>
                      <Input className="h-9" value={editor.brandName} onChange={(e) => setEditor({ ...editor, brandName: e.target.value })} />
                    </div>
                    <GrowthMediaPicker
                      label="Logo"
                      value={editor.logoUrl}
                      acceptedTypes={["logo", "image"]}
                      allowManualUrl
                      onChange={(url) => setEditor({ ...editor, logoUrl: url })}
                    />
                    <GrowthMediaPicker
                      label="Hero / banner image"
                      value={editor.heroImageUrl}
                      acceptedTypes={["hero", "image"]}
                      allowManualUrl
                      onChange={(url) => setEditor({ ...editor, heroImageUrl: url })}
                    />
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Brand color</Label>
                      <Input className="h-9" type="color" value={editor.brandColor} onChange={(e) => setEditor({ ...editor, brandColor: e.target.value })} />
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Accent button color</Label>
                      <Input className="h-9" type="color" value={editor.accentColor} onChange={(e) => setEditor({ ...editor, accentColor: e.target.value })} />
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Duration (minutes)</Label>
                      <Input className="h-9" value={editor.durationMinutes} onChange={(e) => setEditor({ ...editor, durationMinutes: e.target.value })} />
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Buffer before (minutes)</Label>
                      <Input className="h-9" value={editor.bufferBeforeMinutes} onChange={(e) => setEditor({ ...editor, bufferBeforeMinutes: e.target.value })} />
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Buffer after (minutes)</Label>
                      <Input className="h-9" value={editor.bufferAfterMinutes} onChange={(e) => setEditor({ ...editor, bufferAfterMinutes: e.target.value })} />
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Minimum notice (hours)</Label>
                      <Input className="h-9" value={editor.minimumNoticeHours} onChange={(e) => setEditor({ ...editor, minimumNoticeHours: e.target.value })} />
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Max meetings per day</Label>
                      <Input className="h-9" placeholder="Unlimited" value={editor.maxMeetingsPerDay} onChange={(e) => setEditor({ ...editor, maxMeetingsPerDay: e.target.value })} />
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Scheduling horizon</Label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                        value={editor.schedulingHorizonPreset}
                        onChange={(event) =>
                          setEditor({
                            ...editor,
                            schedulingHorizonPreset: event.target.value,
                            schedulingHorizonDays:
                              event.target.value === "custom" ? editor.schedulingHorizonDays : event.target.value,
                          })
                        }
                      >
                        {HORIZON_PRESETS.map((preset) => (
                          <option key={preset} value={preset}>
                            {preset === "custom" ? "Custom days" : `${preset} days`}
                          </option>
                        ))}
                      </select>
                    </div>
                    {editor.schedulingHorizonPreset === "custom" ? (
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Custom horizon (days)</Label>
                        <Input className="h-9" value={editor.schedulingHorizonDays} onChange={(e) => setEditor({ ...editor, schedulingHorizonDays: e.target.value })} />
                      </div>
                    ) : null}
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Host timezone</Label>
                      <GrowthIanaTimezoneSelect
                        value={editor.timezone}
                        onChange={(timezone) => setEditor({ ...editor, timezone })}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Preview: {formatIanaTimezoneOption(resolveBookingTimezone(editor.timezone))}
                      </p>
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Timezone mode</Label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                        value={editor.timezoneMode}
                        onChange={(event) =>
                          setEditor({
                            ...editor,
                            timezoneMode: event.target.value as EditorState["timezoneMode"],
                          })
                        }
                      >
                        {GROWTH_BOOKING_TIMEZONE_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {TIMEZONE_MODE_LABELS[mode]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Public page theme</Label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                        value={editor.publicThemeMode}
                        onChange={(event) =>
                          setEditor({
                            ...editor,
                            publicThemeMode: event.target.value as EditorState["publicThemeMode"],
                          })
                        }
                      >
                        {GROWTH_BOOKING_PUBLIC_THEME_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {GROWTH_BOOKING_PUBLIC_THEME_MODE_LABELS[mode]}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-muted-foreground">
                        Controls light/dark on the public `/book/[slug]` page only. Preview uses the selected value before save.
                      </p>
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Meeting type label</Label>
                      <Input className="h-9" value={editor.meetingType} onChange={(e) => setEditor({ ...editor, meetingType: e.target.value })} />
                    </div>
                  </div>

                  <div className={GROWTH_SETTINGS_FORM_GAP}>
                    <Label className="text-xs">Description</Label>
                    <Textarea rows={2} value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} />
                  </div>
                  <div className={GROWTH_SETTINGS_FORM_GAP}>
                    <Label className="text-xs">Footer note</Label>
                    <Textarea rows={2} value={editor.footerNote} onChange={(e) => setEditor({ ...editor, footerNote: e.target.value })} />
                  </div>
                  <div className={GROWTH_SETTINGS_FORM_GAP}>
                    <Label className="text-xs">Confirmation message</Label>
                    <Textarea rows={2} value={editor.confirmationMessage} onChange={(e) => setEditor({ ...editor, confirmationMessage: e.target.value })} />
                  </div>

                  <GrowthBookingAvailabilityEditor
                    schedule={editor.weeklySchedule}
                    onChange={(weeklySchedule) => setEditor({ ...editor, weeklySchedule })}
                    disabled={saving}
                  />

                  <div className="space-y-2 rounded-md border border-border/70 p-2.5 dark:border-[#25324C]">
                    <p className="text-xs font-medium">Meeting location</p>
                    {!isOperator ? (
                      <p className="text-[11px] text-muted-foreground">{GROWTH_MEETING_LOCATION_HELPER_COPY}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Override the workspace default for this booking page only.
                      </p>
                    )}
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Meeting provider override</Label>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                        value={editor.meetingProviderOverride}
                        onChange={(event) =>
                          setEditor({
                            ...editor,
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
                          editor.autoCreateMeetingLinkOverride === null
                            ? "inherit"
                            : editor.autoCreateMeetingLinkOverride
                              ? "on"
                              : "off"
                        }
                        onChange={(event) => {
                          const value = event.target.value
                          setEditor({
                            ...editor,
                            autoCreateMeetingLinkOverride: value === "inherit" ? null : value === "on",
                          })
                        }}
                        disabled={saving}
                      >
                        <option value="inherit">Inherit platform default</option>
                        <option value="on">On</option>
                        <option value="off">Off</option>
                      </select>
                    </div>
                    {meetingLocationNeedsManualUrl(provider) ? (
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Manual meeting URL</Label>
                        <Input
                          className="h-9"
                          value={editor.manualMeetingUrl}
                          placeholder="https://zoom.us/j/… or Teams link"
                          onChange={(e) => setEditor({ ...editor, manualMeetingUrl: e.target.value })}
                        />
                      </div>
                    ) : null}
                    {meetingLocationNeedsLocationLabel(provider) ? (
                      <div className={GROWTH_SETTINGS_FORM_GAP}>
                        <Label className="text-xs">Phone number or location text</Label>
                        <Input
                          className="h-9"
                          value={editor.customLocation}
                          placeholder="Phone number, address, or call notes"
                          onChange={(e) => setEditor({ ...editor, customLocation: e.target.value })}
                        />
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-dashed border-border px-4 py-4">
                    <p className="text-sm font-medium">Create a booking page</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Set up your first public scheduling link with availability, duration, and confirmation settings.
                    </p>
                  </div>
                  <p className="text-xs font-medium">New booking page</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Internal name</Label>
                      <Input className="h-9" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Custom slug</Label>
                      <Input className="h-9" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Public page title</Label>
                      <Input className="h-9" value={form.pageTitle} onChange={(e) => setForm({ ...form, pageTitle: e.target.value })} />
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Duration (minutes)</Label>
                      <Input className="h-9" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
                    </div>
                    <div className={GROWTH_SETTINGS_FORM_GAP}>
                      <Label className="text-xs">Timezone</Label>
                      <Input className="h-9" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
                    </div>
                  </div>
                  <GrowthSettingsToggleRow
                    label={isOperator ? "Publish after creating" : "Enable after create"}
                    checked={form.enabled}
                    onCheckedChange={(enabled) => setForm({ ...form, enabled })}
                  />
                  <Button type="button" size="sm" disabled={saving || !form.name.trim()} onClick={() => void createPage()}>
                    {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                    {isOperator ? "Create booking page" : "Create Booking Page"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {message ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {message}
          </p>
        ) : null}
      </div>
    </GrowthSettingsCard>
  )
}
