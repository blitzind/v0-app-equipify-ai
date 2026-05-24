"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { GrowthLiveCoachingSettings } from "@/lib/growth/realtime/providers/provider-types"

type ConnectionOption = { id: string; label: string; provider: string; status: string }

export function GrowthLiveCoachingSettingsPanel() {
  const [settings, setSettings] = useState<GrowthLiveCoachingSettings | null>(null)
  const [connections, setConnections] = useState<ConnectionOption[]>([])
  const [keywordsDraft, setKeywordsDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [settingsRes, connectionsRes] = await Promise.all([
        fetch("/api/platform/growth/live-coaching/settings", { cache: "no-store" }),
        fetch("/api/platform/growth/realtime/providers/connections", { cache: "no-store" }),
      ])
      const settingsData = (await settingsRes.json().catch(() => ({}))) as {
        ok?: boolean
        settings?: GrowthLiveCoachingSettings
      }
      const connectionsData = (await connectionsRes.json().catch(() => ({}))) as {
        ok?: boolean
        connections?: ConnectionOption[]
      }
      if (!settingsRes.ok || !settingsData.ok || !settingsData.settings) {
        throw new Error("Could not load live coaching settings.")
      }
      setSettings(settingsData.settings)
      setKeywordsDraft((settingsData.settings.customKeywords ?? []).join(", "))
      setConnections(connectionsData.connections ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(patch: Partial<GrowthLiveCoachingSettings>) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/live-coaching/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        settings?: GrowthLiveCoachingSettings
        message?: string
      }
      if (!res.ok || !data.ok || !data.settings) throw new Error(data.message ?? "Save failed.")
      setSettings(data.settings)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  async function testActiveProvider() {
    if (!settings?.activeProviderConnectionId) return
    setTesting(true)
    setTestMessage(null)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/realtime/providers/connections/${settings.activeProviderConnectionId}/validate`,
        { method: "POST" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        validation?: { message?: string; readinessStatus?: string }
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Test connection failed.")
      }
      setTestMessage(
        `${data.validation?.message ?? "Connection verified."} Readiness: ${data.validation?.readinessStatus?.replace(/_/g, " ") ?? "unknown"}.`,
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test connection failed.")
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading live coaching settings…
      </div>
    )
  }

  if (!settings) return null

  return (
    <GrowthEngineCard title="Live Coaching">
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <div className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Active transcript provider</span>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={settings.activeProviderConnectionId ?? ""}
            onChange={(event) =>
              void save({
                activeProviderConnectionId: event.target.value ? event.target.value : null,
              })
            }
            disabled={saving}
          >
            <option value="">Manual / stub fallback</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.label} ({connection.provider})
              </option>
            ))}
          </select>
        </label>

        {settings.activeProviderConnectionId ? (
          <div className="space-y-2 rounded-lg border border-border bg-muted/20 px-3 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testing || saving}
              onClick={() => void testActiveProvider()}
            >
              {testing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Test Connection
            </Button>
            {testMessage ? <p className="text-xs text-muted-foreground">{testMessage}</p> : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Manual transcript mode active until a provider is selected. Deepgram, AssemblyAI, and OpenAI Realtime
            support browser mic transcription when connected and ready. OpenAI is transcription-only — no voice
            output.
          </p>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.speakerSeparationEnabled}
            onChange={(event) => void save({ speakerSeparationEnabled: event.target.checked })}
            disabled={saving}
          />
          Enable speaker separation
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.keywordEventsEnabled}
            onChange={(event) => void save({ keywordEventsEnabled: event.target.checked })}
            disabled={saving}
          />
          Enable keyword events
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Custom keywords (comma-separated)</span>
          <Input
            value={keywordsDraft}
            onChange={(event) => setKeywordsDraft(event.target.value)}
            onBlur={() =>
              void save({
                customKeywords: keywordsDraft
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean),
              })
            }
            disabled={saving}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Transcript confidence threshold ({settings.transcriptConfidenceThreshold})</span>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.transcriptConfidenceThreshold}
            onChange={(event) => void save({ transcriptConfidenceThreshold: Number(event.target.value) })}
            disabled={saving}
            className="w-full"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Critical guidance threshold ({settings.criticalGuidanceThreshold})</span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.criticalGuidanceThreshold}
              onChange={(event) => void save({ criticalGuidanceThreshold: Number(event.target.value) })}
              disabled={saving}
              className="w-full"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Normal guidance threshold ({settings.normalGuidanceThreshold})</span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.normalGuidanceThreshold}
              onChange={(event) => void save({ normalGuidanceThreshold: Number(event.target.value) })}
              disabled={saving}
              className="w-full"
            />
          </label>
        </div>

        <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void load()}>
          Refresh settings
        </Button>
      </div>
    </GrowthEngineCard>
  )
}
