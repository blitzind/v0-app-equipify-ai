"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, PhoneOutgoing } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import type { VoiceAiOutboundReadinessSnapshot } from "@/lib/voice/ai-outbound/types"
import { VOICE_AI_OUTBOUND_QA_MARKER } from "@/lib/voice/ai-outbound/types"

export function GrowthAiOutboundReadinessSection() {
  const [readiness, setReadiness] = useState<VoiceAiOutboundReadinessSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/ai-outbound/readiness", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { readiness?: VoiceAiOutboundReadinessSnapshot }
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
      data-voice-ai-outbound-qa-marker={VOICE_AI_OUTBOUND_QA_MARKER}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <PhoneOutgoing className="size-4" />
        AI Outbound Readiness
      </p>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge
            label={readiness.outboundEnabled ? "Outbound AI enabled" : "Outbound AI disabled"}
            tone={readiness.outboundEnabled ? "healthy" : "neutral"}
          />
          <GrowthBadge label="Autonomous outbound disabled" tone="neutral" />
          <GrowthBadge label="Approval required" tone="neutral" />
          <GrowthBadge
            label={readiness.complianceReadiness ? "Compliance ready" : "Compliance pending"}
            tone={readiness.complianceReadiness ? "healthy" : "neutral"}
          />
          <GrowthBadge
            label={readiness.voicemailReadiness ? "Voicemail ready" : "Voicemail pending"}
            tone={readiness.voicemailReadiness ? "healthy" : "neutral"}
          />
        </div>
        <p className="text-xs text-muted-foreground">{readiness.message}</p>
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <li>Provider: {readiness.providerMode.replace(/_/g, " ")}</li>
          <li>Consent readiness: {readiness.consentReadiness ? "ready" : "pending"}</li>
          <li>Operator approval: {readiness.operatorApprovalReady ? "ready" : "pending"}</li>
          <li>Escalation routing: {readiness.escalationRoutingReady ? "ready" : "pending"}</li>
          <li>Provider fallback: {readiness.fallbackReady ? "ready" : "pending"}</li>
          <li>Schema: {readiness.schemaReady ? "ready" : "pending migration"}</li>
          <li>
            Active sessions: {readiness.activeSessionCount} / {readiness.maxActiveSessions}
          </li>
          <li>Pending approval: {readiness.pendingApprovalCount}</li>
          <li>Max concurrent initiations: {readiness.maxConcurrentInitiations}</li>
        </ul>
      </div>
    </section>
  )
}
