"use client"

import { useCallback, useEffect, useState } from "react"
import type { GrowthVideoSettingsRecord } from "@/lib/growth/videos/growth-video-settings-types"

const ENDPOINT = "/api/growth/videos/settings"

type ApiEnvelope = {
  ok?: boolean
  message?: string
  settings?: GrowthVideoSettingsRecord
  persisted?: boolean
}

export function useGrowthVideoSettings() {
  const [settings, setSettings] = useState<GrowthVideoSettingsRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(ENDPOINT, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as ApiEnvelope
      if (!res.ok || !data.ok || !data.settings) {
        throw new Error(data.message ?? "Could not load video settings.")
      }
      setSettings(data.settings)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load video settings.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true)
      setError(null)
      try {
        const res = await fetch(ENDPOINT, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = (await res.json().catch(() => ({}))) as ApiEnvelope
        if (!res.ok || !data.ok || !data.settings) {
          throw new Error(data.message ?? "Could not save video settings.")
        }
        setSettings(data.settings)
        return true
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Could not save video settings.")
        return false
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  return { settings, loading, saving, error, refresh, patch }
}
