"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_INNER_GAP,
  GrowthSettingsBadge,
  GrowthSettingsCard,
  GrowthSettingsToggleRow,
} from "@/components/growth/growth-settings-ui"
import type { GrowthPlatformCommunicationSettings } from "@/lib/growth/communication/types"
import {
  GROWTH_MEETING_LOCATION_HELPER_COPY,
  GROWTH_MEETING_LOCATION_PROVIDER_LABELS,
  GROWTH_MEETING_LOCATION_PROVIDERS,
  type GrowthMeetingLocationProvider,
  type GrowthMeetingLocationProviderReadiness,
  buildMeetingLocationProviderReadiness,
} from "@/lib/growth/meeting-location/meeting-location-provider-types"

export function GrowthMeetingLocationSettingsPanel() {
  const [settings, setSettings] = useState<GrowthPlatformCommunicationSettings | null>(null)
  const [readiness, setReadiness] = useState<GrowthMeetingLocationProviderReadiness[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/communication-settings", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        settings?: GrowthPlatformCommunicationSettings
        providerReadiness?: GrowthMeetingLocationProviderReadiness[]
      }
      if (res.ok && data.ok && data.settings) {
        setSettings(data.settings)
        setReadiness(
          data.providerReadiness ??
            buildMeetingLocationProviderReadiness({ googleCalendarConnected: false }),
        )
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(patch: Partial<GrowthPlatformCommunicationSettings>) {
    if (!settings) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/communication-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        settings?: GrowthPlatformCommunicationSettings
        message?: string
      }
      if (!res.ok || !data.ok || !data.settings) throw new Error(data.message ?? "Save failed.")
      setSettings(data.settings)
      setMessage("Meeting location settings saved.")
      await load()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Loading meeting location settings…
      </div>
    )
  }

  if (!settings) return null

  return (
    <GrowthSettingsCard
      title="Meeting Location Providers"
      icon={<MapPin className="size-4" />}
    >
      <div className={GROWTH_SETTINGS_INNER_GAP}>
        <p className="text-xs text-muted-foreground">{GROWTH_MEETING_LOCATION_HELPER_COPY}</p>

        <div className={GROWTH_SETTINGS_FORM_GAP}>
          <Label className="text-xs">Default Meeting Provider</Label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
            value={settings.defaultMeetingProvider}
            onChange={(event) =>
              void save({ defaultMeetingProvider: event.target.value as GrowthMeetingLocationProvider })
            }
            disabled={saving}
          >
            {GROWTH_MEETING_LOCATION_PROVIDERS.map((provider) => (
              <option key={provider} value={provider}>
                {GROWTH_MEETING_LOCATION_PROVIDER_LABELS[provider]}
              </option>
            ))}
          </select>
        </div>

        <GrowthSettingsToggleRow
          label="Auto-create meeting link when scheduled"
          checked={settings.autoCreateMeetingLink}
          onCheckedChange={(checked) => void save({ autoCreateMeetingLink: checked })}
          disabled={saving}
        />

        <div className="grid gap-1.5 sm:grid-cols-2">
          {readiness.map((entry) => (
            <div
              key={entry.provider}
              className="flex items-center justify-between rounded-md border border-border/70 px-2.5 py-2 text-xs dark:border-[#25324C]"
            >
              <span className="font-medium">{entry.label}</span>
              <GrowthSettingsBadge
                label={entry.statusLabel}
                tone={
                  entry.status === "ready"
                    ? "healthy"
                    : entry.status === "setup_required"
                      ? "attention"
                      : "neutral"
                }
              />
            </div>
          ))}
        </div>

        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </div>
    </GrowthSettingsCard>
  )
}
