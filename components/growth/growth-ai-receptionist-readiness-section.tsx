"use client"

import { useCallback, useEffect, useState } from "react"
import { Headphones, Loader2 } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import type { VoiceAiReceptionistReadinessSnapshot } from "@/lib/voice/ai-receptionist/types"
import { VOICE_AI_RECEPTIONIST_QA_MARKER } from "@/lib/voice/ai-receptionist/types"

export function GrowthAiReceptionistReadinessSection() {
  const [readiness, setReadiness] = useState<VoiceAiReceptionistReadinessSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/ai-receptionist/readiness", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { readiness?: VoiceAiReceptionistReadinessSnapshot }
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
      data-voice-ai-receptionist-qa-marker={VOICE_AI_RECEPTIONIST_QA_MARKER}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Headphones className="size-4" />
        AI Receptionist Readiness
      </p>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge
            label={readiness.receptionistEnabled ? "Inbound AI enabled" : "Inbound AI disabled"}
            tone={readiness.receptionistEnabled ? "healthy" : "neutral"}
          />
          <GrowthBadge
            label={readiness.realtimeAudioReady ? "Realtime audio ready" : "Realtime audio pending"}
            tone={readiness.realtimeAudioReady ? "healthy" : "neutral"}
          />
          <GrowthBadge label={readiness.guardrailsEnabled ? "Guardrails enabled" : "Guardrails off"} tone="neutral" />
          <GrowthBadge label="Autonomous outbound disabled" tone="neutral" />
          <GrowthBadge label="Bounded conversation only" tone="neutral" />
        </div>
        <p className="text-xs text-muted-foreground">{readiness.message}</p>
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <li>Provider: {readiness.providerMode.replace(/_/g, " ")}</li>
          <li>FAQ readiness: {readiness.faqReady ? "ready" : "pending"}</li>
          <li>Qualification flows: {readiness.qualificationFlowReady ? "ready" : "pending"}</li>
          <li>Escalation routing: {readiness.escalationRoutingReady ? "ready" : "pending"}</li>
          <li>Operator takeover: {readiness.operatorTakeoverReady ? "ready" : "pending"}</li>
          <li>Schema: {readiness.schemaReady ? "ready" : "pending migration"}</li>
          <li>
            Active sessions: {readiness.activeSessionCount} / {readiness.maxActiveSessions}
          </li>
          <li>Latency target: {readiness.latencyTargetMs}ms</li>
        </ul>
      </div>
    </section>
  )
}
