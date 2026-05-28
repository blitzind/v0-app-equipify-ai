"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, Loader2 } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import type { VoiceObservabilityReadinessSnapshot } from "@/lib/voice/observability/types"
import { VOICE_OBSERVABILITY_QA_MARKER } from "@/lib/voice/observability/types"

export function GrowthVoiceObservabilityReadinessSection() {
  const [readiness, setReadiness] = useState<VoiceObservabilityReadinessSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/observability/readiness", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { readiness?: VoiceObservabilityReadinessSnapshot }
      if (res.ok && data.readiness) setReadiness(data.readiness)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <section className={GROWTH_SETTINGS_SECTION_GAP}>
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </section>
    )
  }

  if (!readiness) return null

  return (
    <section
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-voice-observability-qa-marker={VOICE_OBSERVABILITY_QA_MARKER}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Activity className="size-4" />
        Voice Observability Readiness
      </p>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge
            label={readiness.observabilityEnabled ? "Observability enabled" : "Observability disabled"}
            tone={readiness.observabilityEnabled ? "healthy" : "neutral"}
          />
          <GrowthBadge label="Autonomous remediation disabled" tone="neutral" />
          <GrowthBadge label="Auto provider switch disabled" tone="neutral" />
          <GrowthBadge
            label={readiness.realtimeMonitoringReady ? "Realtime monitoring ready" : "Realtime pending"}
            tone={readiness.realtimeMonitoringReady ? "healthy" : "neutral"}
          />
        </div>
        <p className="text-xs text-muted-foreground">{readiness.message}</p>
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <li>Provider health: {readiness.providerHealthVisibility ? "ready" : "pending"}</li>
          <li>Orchestration analytics: {readiness.orchestrationAnalyticsReady ? "ready" : "pending"}</li>
          <li>Compliance analytics: {readiness.complianceAnalyticsReady ? "ready" : "pending"}</li>
          <li>Campaign analytics: {readiness.campaignAnalyticsReady ? "ready" : "pending"}</li>
          <li>Alert foundations: {readiness.alertFoundationReady ? "ready" : "pending"}</li>
          <li>Transcript observability: {readiness.transcriptObservabilityReady ? "ready" : "pending"}</li>
          <li>Schema: {readiness.schemaReady ? "ready" : "pending migration"}</li>
          <li>
            Retention window: {readiness.eventRetentionDays}d · Rolling: {readiness.rollingWindowHours}h
          </li>
        </ul>
      </div>
    </section>
  )
}
