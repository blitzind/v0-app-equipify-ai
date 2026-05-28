"use client"

import { useCallback, useEffect, useState } from "react"
import { Layers, Loader2 } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import type { VoiceMultichannelIntelligenceReadinessSnapshot } from "@/lib/voice/multi-channel-intelligence/types"
import { VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER } from "@/lib/voice/multi-channel-intelligence/types"

export function GrowthMultichannelIntelligenceReadinessSection() {
  const [readiness, setReadiness] = useState<VoiceMultichannelIntelligenceReadinessSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/multichannel-intelligence/readiness", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { readiness?: VoiceMultichannelIntelligenceReadinessSnapshot }
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
      data-voice-multichannel-intelligence-qa-marker={VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Layers className="size-4" />
        Multi-Channel Intelligence Readiness
      </p>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge
            label={readiness.intelligenceEnabled ? "Intelligence enabled" : "Intelligence disabled"}
            tone={readiness.intelligenceEnabled ? "healthy" : "neutral"}
          />
          <GrowthBadge label="Autonomous omnichannel disabled" tone="neutral" />
          <GrowthBadge
            label={readiness.unifiedTimelineReady ? "Unified timeline ready" : "Timeline pending"}
            tone={readiness.unifiedTimelineReady ? "healthy" : "neutral"}
          />
        </div>
        <p className="text-xs text-muted-foreground">{readiness.message}</p>
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <li>Cross-channel coordination: {readiness.crossChannelCoordinationReady ? "ready" : "pending"}</li>
          <li>Escalation continuity: {readiness.escalationContinuityReady ? "ready" : "pending"}</li>
          <li>Communication health: {readiness.communicationHealthReady ? "ready" : "pending"}</li>
          <li>Preferred-channel intelligence: {readiness.preferredChannelIntelligenceReady ? "ready" : "pending"}</li>
          <li>Workflow integration: {readiness.workflowIntegrationReady ? "ready" : "pending"}</li>
          <li>Observability integration: {readiness.observabilityIntegrationReady ? "ready" : "pending"}</li>
          <li>Future channel hooks: {readiness.futureChannelHooksReady ? "ready" : "pending"}</li>
          <li>Schema: {readiness.schemaReady ? "ready" : "pending migration"}</li>
        </ul>
      </div>
    </section>
  )
}
