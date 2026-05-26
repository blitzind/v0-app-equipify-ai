"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Phone, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_SECTION_GAP,
  GrowthSettingsBadge,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
import {
  GROWTH_GOOGLE_VOICE_BRIDGE_QA_MARKER,
  NATIVE_DIALER_PROVIDER_IDS,
  NATIVE_DIALER_PROVIDER_LABELS,
  type NativeDialerProviderId,
} from "@/lib/growth/native-dialer/native-dialer-types"

export function GrowthNativeDialerSettingsPanel() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [primaryProvider, setPrimaryProvider] = useState<NativeDialerProviderId>("stub")
  const [fallbackProvider, setFallbackProvider] = useState<NativeDialerProviderId>("stub")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/calls/settings", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        settings?: { primaryProvider?: NativeDialerProviderId; fallbackProvider?: NativeDialerProviderId }
        message?: string
      }
      if (!res.ok || !data.ok || !data.settings) throw new Error(data.message ?? "Could not load native dialer settings.")
      setPrimaryProvider(data.settings.primaryProvider ?? "stub")
      setFallbackProvider(data.settings.fallbackProvider ?? "stub")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/platform/growth/calls/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryProvider, fallbackProvider }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not save native dialer settings.")
      setSuccess("Native dialer provider settings saved.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <GrowthSettingsCard title="Native Dialer providers" icon={<Phone className="size-4" />}>
      <div className={GROWTH_SETTINGS_SECTION_GAP} data-qa-marker={GROWTH_GOOGLE_VOICE_BRIDGE_QA_MARKER}>
        <p className="text-sm text-muted-foreground">
          Operator-controlled telephony adapters for the Call Workspace. Google Voice Bridge opens Google Voice
          externally — no stored credentials or autonomous dialing.
        </p>
        <p className="text-sm text-muted-foreground">
          Google Voice Bridge cannot auto-dial. It opens Google Voice and tracks the call after you manually place it.
        </p>
        <GrowthSettingsBadge label={GROWTH_GOOGLE_VOICE_BRIDGE_QA_MARKER} tone="neutral" />

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading native dialer settings…
          </p>
        ) : (
          <div className={GROWTH_SETTINGS_FORM_GAP}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="native-dialer-primary">Primary provider</Label>
                <select
                  id="native-dialer-primary"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={primaryProvider}
                  onChange={(e) => setPrimaryProvider(e.target.value as NativeDialerProviderId)}
                >
                  {NATIVE_DIALER_PROVIDER_IDS.map((id) => (
                    <option key={id} value={id}>
                      {NATIVE_DIALER_PROVIDER_LABELS[id]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="native-dialer-fallback">Fallback provider</Label>
                <select
                  id="native-dialer-fallback"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={fallbackProvider}
                  onChange={(e) => setFallbackProvider(e.target.value as NativeDialerProviderId)}
                >
                  {NATIVE_DIALER_PROVIDER_IDS.map((id) => (
                    <option key={id} value={id}>
                      {NATIVE_DIALER_PROVIDER_LABELS[id]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p> : null}

            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Save provider settings
            </Button>
          </div>
        )}
      </div>
    </GrowthSettingsCard>
  )
}
