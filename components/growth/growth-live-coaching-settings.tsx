"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthLiveCoachingProviderComparisonTable } from "@/components/growth/growth-live-coaching-provider-selection"
import {
  GROWTH_SETTINGS_FORM_GAP,
  GROWTH_SETTINGS_INNER_GAP,
  GrowthSettingsBadge,
  GrowthSettingsCard,
  GrowthSettingsToggleRow,
} from "@/components/growth/growth-settings-ui"
import {
  buildLiveCoachingProviderComparisonRows,
  buildLiveCoachingProviderReadiness,
  explainLiveCoachingProviderFallback,
  recommendLiveCoachingProvider,
} from "@/lib/growth/realtime/live-coaching/live-coaching-provider-selection"
import { LIVE_COACHING_QA_PROOF_MARKER } from "@/lib/growth/realtime/live-coaching/live-coaching-production-proof"
import type { GrowthLiveCoachingSettings, RealtimeProviderConnection } from "@/lib/growth/realtime/providers/provider-types"

export function GrowthLiveCoachingSettingsPanel() {
  const [settings, setSettings] = useState<GrowthLiveCoachingSettings | null>(null)
  const [connections, setConnections] = useState<RealtimeProviderConnection[]>([])
  const [keywordsDraft, setKeywordsDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recommendation = useMemo(() => recommendLiveCoachingProvider(connections), [connections])
  const comparisonRows = useMemo(
    () =>
      buildLiveCoachingProviderComparisonRows({
        connections,
        activeProviderConnectionId: settings?.activeProviderConnectionId ?? null,
        recommendedConnectionId: recommendation.connectionId,
      }),
    [connections, recommendation.connectionId, settings?.activeProviderConnectionId],
  )
  const fallbackExplanation = useMemo(
    () =>
      explainLiveCoachingProviderFallback({
        activeProviderConnectionId: settings?.activeProviderConnectionId ?? null,
        connections,
      }),
    [connections, settings?.activeProviderConnectionId],
  )
  const activeReadiness = useMemo(() => {
    const active = connections.find((connection) => connection.id === settings?.activeProviderConnectionId)
    return active ? buildLiveCoachingProviderReadiness(active) : null
  }, [connections, settings?.activeProviderConnectionId])

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
        connections?: RealtimeProviderConnection[]
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
    <GrowthSettingsCard
      title="Live Coaching"
      icon={<Radio className="size-4" />}
      headerAside={
        <div className="flex items-center gap-1.5">
          <GrowthSettingsBadge label={LIVE_COACHING_QA_PROOF_MARKER} tone="neutral" />
        </div>
      }
    >
      {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}

      <div className={GROWTH_SETTINGS_INNER_GAP}>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground">Provider Comparison</span>
            {recommendation.connectionId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs"
                disabled={saving || settings.activeProviderConnectionId === recommendation.connectionId}
                onClick={() => void save({ activeProviderConnectionId: recommendation.connectionId })}
              >
                Use Recommended
              </Button>
            ) : null}
          </div>
          {recommendation.reason ? (
            <p className="text-[11px] text-muted-foreground">{recommendation.reason}</p>
          ) : null}
          <GrowthLiveCoachingProviderComparisonTable rows={comparisonRows} compact />
        </div>

        <div className="grid gap-2.5 lg:grid-cols-2">
          <label className={GROWTH_SETTINGS_FORM_GAP}>
            <span className="text-xs font-medium">Active Transcript Provider</span>
            <select
              className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm"
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
                  {connection.label} ({connection.provider.replace(/_/g, " ")})
                </option>
              ))}
            </select>
          </label>

          <label className={GROWTH_SETTINGS_FORM_GAP}>
            <span className="text-xs font-medium">Custom Keywords (comma-separated)</span>
            <Input
              className="h-9"
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
        </div>

        {settings.activeProviderConnectionId ? (
          <div className="space-y-2 rounded-lg border border-border/70 px-2.5 py-2 dark:border-[#25324C]">
            {activeReadiness ? (
              <div className="flex flex-wrap gap-1.5">
                <GrowthSettingsBadge
                  label={activeReadiness.configured ? "Configured" : "Not configured"}
                  tone="neutral"
                />
                <GrowthSettingsBadge
                  label={activeReadiness.validated ? "Validated" : "Not validated"}
                  tone="neutral"
                />
                <GrowthSettingsBadge
                  label={activeReadiness.browserMicSupported ? "Browser mic" : "No browser mic"}
                  tone="neutral"
                />
                {activeReadiness.circuitOpen ? (
                  <GrowthSettingsBadge label="Circuit open" tone="attention" />
                ) : activeReadiness.degraded ? (
                  <GrowthSettingsBadge label="Degraded" tone="attention" />
                ) : (
                  <GrowthSettingsBadge
                    label={activeReadiness.readinessStatus.replace(/_/g, " ")}
                    tone="healthy"
                  />
                )}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs"
                disabled={testing || saving}
                onClick={() => void testActiveProvider()}
              >
                {testing ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                Test Connection
              </Button>
              {testMessage ? <span className="text-[11px] text-muted-foreground">{testMessage}</span> : null}
            </div>
            {!activeReadiness?.eligibleForRecommendation ? (
              <p className="text-[11px] text-amber-950 dark:text-amber-100">{fallbackExplanation}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Manual transcript mode until a provider is selected. Deepgram, AssemblyAI, and OpenAI Realtime support
            browser mic when connected.
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <GrowthSettingsToggleRow
            label="Enable speaker separation"
            checked={settings.speakerSeparationEnabled}
            onCheckedChange={(checked) => void save({ speakerSeparationEnabled: checked })}
            disabled={saving}
          />
          <GrowthSettingsToggleRow
            label="Enable keyword events"
            checked={settings.keywordEventsEnabled}
            onCheckedChange={(checked) => void save({ keywordEventsEnabled: checked })}
            disabled={saving}
          />
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className={GROWTH_SETTINGS_FORM_GAP}>
            <span className="text-xs font-medium">
              Transcript confidence ({settings.transcriptConfidenceThreshold})
            </span>
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
          <label className={GROWTH_SETTINGS_FORM_GAP}>
            <span className="text-xs font-medium">
              Critical guidance ({settings.criticalGuidanceThreshold})
            </span>
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
          <label className={GROWTH_SETTINGS_FORM_GAP}>
            <span className="text-xs font-medium">
              Normal guidance ({settings.normalGuidanceThreshold})
            </span>
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

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          disabled={saving}
          onClick={() => void load()}
        >
          Refresh Settings
        </Button>
      </div>
    </GrowthSettingsCard>
  )
}
