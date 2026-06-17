"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_OPERATOR_NOTIFICATION_EVENT_GROUPS,
  GROWTH_OPERATOR_NOTIFICATION_EVENTS,
  GROWTH_OPERATOR_NOTIFICATION_EVENT_TO_GROUP,
  type GrowthOperatorNotificationEvent,
} from "@/lib/growth/notifications/growth-notification-events"
import type { GrowthOperatorNotificationEffectivePreferences } from "@/lib/growth/notifications/growth-notification-preferences-types"
import { GROWTH_OPERATOR_NOTIFICATION_SEVERITIES } from "@/lib/growth/notifications/growth-notification-severity"

type PreferencesResponse = {
  ok?: boolean
  preferences?: GrowthOperatorNotificationEffectivePreferences & {
    id?: string | null
    createdAt?: string | null
    updatedAt?: string | null
  }
  message?: string
}

const TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
]

function groupEventsByCategory(): Record<string, GrowthOperatorNotificationEvent[]> {
  const grouped: Record<string, GrowthOperatorNotificationEvent[]> = {}
  for (const group of GROWTH_OPERATOR_NOTIFICATION_EVENT_GROUPS) {
    grouped[group] = []
  }
  for (const event of GROWTH_OPERATOR_NOTIFICATION_EVENTS) {
    grouped[GROWTH_OPERATOR_NOTIFICATION_EVENT_TO_GROUP[event]].push(event)
  }
  return grouped
}

export function GrowthNotificationPreferencesPanel() {
  const groupedEvents = useMemo(() => groupEventsByCategory(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [form, setForm] = useState<GrowthOperatorNotificationEffectivePreferences>({
    inAppEnabled: true,
    browserPushEnabled: true,
    emailNotificationsEnabled: true,
    minimumSeverity: "low",
    disabledEventTypes: [],
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    quietHoursTimezone: "UTC",
  })

  const refreshPreferences = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/notifications/preferences", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as PreferencesResponse
      if (!res.ok || !data.ok || !data.preferences) {
        throw new Error(data.message ?? "Could not load notification preferences.")
      }

      setForm({
        inAppEnabled: data.preferences.inAppEnabled,
        browserPushEnabled: data.preferences.browserPushEnabled,
        emailNotificationsEnabled: data.preferences.emailNotificationsEnabled,
        minimumSeverity: data.preferences.minimumSeverity,
        disabledEventTypes: [...data.preferences.disabledEventTypes],
        quietHoursEnabled: data.preferences.quietHoursEnabled,
        quietHoursStart: data.preferences.quietHoursStart ?? "22:00",
        quietHoursEnd: data.preferences.quietHoursEnd ?? "07:00",
        quietHoursTimezone: data.preferences.quietHoursTimezone ?? "UTC",
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load notification preferences.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshPreferences()
  }, [refreshPreferences])

  function toggleDisabledEvent(event: GrowthOperatorNotificationEvent) {
    setForm((current) => {
      const disabled = new Set(current.disabledEventTypes)
      if (disabled.has(event)) disabled.delete(event)
      else disabled.add(event)
      return { ...current, disabledEventTypes: [...disabled] }
    })
  }

  async function savePreferences() {
    setSaving(true)
    setError(null)
    setSavedMessage(null)
    try {
      const res = await fetch("/api/platform/growth/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inAppEnabled: form.inAppEnabled,
          browserPushEnabled: form.browserPushEnabled,
          minimumSeverity: form.minimumSeverity,
          disabledEventTypes: form.disabledEventTypes,
          quietHoursEnabled: form.quietHoursEnabled,
          quietHoursStart: form.quietHoursEnabled ? form.quietHoursStart : null,
          quietHoursEnd: form.quietHoursEnabled ? form.quietHoursEnd : null,
          quietHoursTimezone: form.quietHoursEnabled ? form.quietHoursTimezone : null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as PreferencesResponse
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not save notification preferences.")
      setSavedMessage("Preferences saved.")
      await refreshPreferences()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save notification preferences.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-muted-foreground" />
            <p className="font-medium">Notification preferences</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Control in-app persistence and browser push eligibility. Does not delete existing notifications.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <GrowthBadge
              label={form.inAppEnabled ? "In-app enabled" : "In-app disabled"}
              tone={form.inAppEnabled ? "high" : "neutral"}
            />
            <GrowthBadge
              label={form.browserPushEnabled ? "Push enabled" : "Push disabled"}
              tone={form.browserPushEnabled ? "high" : "neutral"}
            />
            <GrowthBadge label={`Min severity: ${form.minimumSeverity}`} tone="neutral" />
          </div>
        </div>

        <Button size="sm" disabled={loading || saving} onClick={() => void savePreferences()}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Save preferences
        </Button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading preferences…</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.inAppEnabled}
                onChange={(event) => setForm((current) => ({ ...current, inAppEnabled: event.target.checked }))}
              />
              In-app notifications
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.browserPushEnabled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, browserPushEnabled: event.target.checked }))
                }
              />
              Browser push notifications
            </label>
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="minimum-severity">
              Minimum severity
            </label>
            <select
              id="minimum-severity"
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.minimumSeverity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  minimumSeverity: event.target.value as GrowthOperatorNotificationEffectivePreferences["minimumSeverity"],
                }))
              }
            >
              {GROWTH_OPERATOR_NOTIFICATION_SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-sm font-medium">Event opt-out</p>
            <p className="text-xs text-muted-foreground">Unchecked events remain enabled.</p>
            <div className="mt-2 space-y-3">
              {Object.entries(groupedEvents).map(([group, events]) => (
                <div key={group}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{group.replace("_", " ")}</p>
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    {events.map((event) => {
                      const enabled = !form.disabledEventTypes.includes(event)
                      return (
                        <label key={event} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={() => toggleDisabledEvent(event)}
                          />
                          {event}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.quietHoursEnabled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, quietHoursEnabled: event.target.checked }))
                }
              />
              Quiet hours (browser push only)
            </label>
            {form.quietHoursEnabled ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="quiet-start">
                    Start
                  </label>
                  <input
                    id="quiet-start"
                    type="time"
                    className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                    value={form.quietHoursStart ?? "22:00"}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, quietHoursStart: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="quiet-end">
                    End
                  </label>
                  <input
                    id="quiet-end"
                    type="time"
                    className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                    value={form.quietHoursEnd ?? "07:00"}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, quietHoursEnd: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground" htmlFor="quiet-timezone">
                    Timezone
                  </label>
                  <select
                    id="quiet-timezone"
                    className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                    value={form.quietHoursTimezone ?? "UTC"}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, quietHoursTimezone: event.target.value }))
                    }
                  >
                    {TIMEZONE_OPTIONS.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {savedMessage ? <p className="mt-3 text-sm text-emerald-600">{savedMessage}</p> : null}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
