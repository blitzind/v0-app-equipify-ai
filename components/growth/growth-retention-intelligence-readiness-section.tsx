"use client"

import { useCallback, useEffect, useState } from "react"
import { HeartPulse, Loader2 } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import type { VoiceRetentionIntelligenceReadinessSnapshot } from "@/lib/voice/retention-intelligence/types"
import { VOICE_RETENTION_INTELLIGENCE_QA_MARKER } from "@/lib/voice/retention-intelligence/types"

export function GrowthRetentionIntelligenceReadinessSection() {
  const [readiness, setReadiness] = useState<VoiceRetentionIntelligenceReadinessSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/retention-intelligence/readiness", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { readiness?: VoiceRetentionIntelligenceReadinessSnapshot }
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
      data-voice-retention-intelligence-qa-marker={VOICE_RETENTION_INTELLIGENCE_QA_MARKER}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <HeartPulse className="size-4" />
        Retention Intelligence Readiness
      </p>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge label="Passive mode" tone="neutral" />
          <GrowthBadge label="Autonomous actions disabled" tone="neutral" />
          <GrowthBadge label="Evidence required" tone="neutral" />
          <GrowthBadge
            label={readiness.relationshipMemoryDependencyReady ? "Relationship memory ready" : "Needs Phase 2C"}
            tone={readiness.relationshipMemoryDependencyReady ? "healthy" : "attention"}
          />
          <GrowthBadge
            label={readiness.revenueIntelligenceDependencyReady ? "Revenue intelligence ready" : "Needs Phase 2D"}
            tone={readiness.revenueIntelligenceDependencyReady ? "healthy" : "attention"}
          />
        </div>
        <p className="text-xs text-muted-foreground">{readiness.message}</p>
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <li>Unresolved issues: {readiness.unresolvedIssueCount}</li>
          <li>Churn risks: {readiness.churnRiskCount}</li>
          <li>Expansion signals: {readiness.expansionSignalCount}</li>
          <li>Active events: {readiness.activeEventCount}</li>
          <li>Schema: {readiness.schemaReady ? "ready" : "pending migration"}</li>
        </ul>
      </div>
    </section>
  )
}
