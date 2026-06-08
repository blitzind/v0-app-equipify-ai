"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Voicemail } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import type { VoiceDropReadinessSnapshot } from "@/lib/voice/voice-drops/types"
import { VOICE_DROP_INFRASTRUCTURE_QA_MARKER } from "@/lib/voice/voice-drops/types"

export function GrowthVoiceDropReadinessSection() {
  const [readiness, setReadiness] = useState<VoiceDropReadinessSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/voice-drops/readiness", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { readiness?: VoiceDropReadinessSnapshot }
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
      data-voice-drop-infrastructure-qa-marker={VOICE_DROP_INFRASTRUCTURE_QA_MARKER}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Voicemail className="size-4" />
        Voice Drop Readiness
      </p>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge
            label={readiness.voiceDropEnabled ? "Voice drops enabled" : "Voice drops disabled"}
            tone={readiness.voiceDropEnabled ? "healthy" : "neutral"}
          />
          <GrowthBadge label="Approval required" tone="neutral" />
          <GrowthBadge label="Compliance gating enabled" tone="neutral" />
          <GrowthBadge label="Autonomous outbound disabled" tone="neutral" />
          {readiness.providerMode === "twilio" ? (
            <GrowthBadge
              label={readiness.twilioOutboundCertified ? "Twilio outbound certified" : "Twilio outbound pending certification"}
              tone={readiness.twilioOutboundCertified ? "healthy" : "neutral"}
            />
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{readiness.message}</p>
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <li>Provider: {readiness.providerMode.replace(/_/g, " ")}</li>
          <li>Compliance gating: {readiness.complianceGatingReady ? "ready" : "pending"}</li>
          <li>Approval workflow: {readiness.approvalWorkflowEnabled ? "enabled" : "off"}</li>
          <li>Opt-out/DNC: {readiness.optOutRegistryReady ? "registry ready" : "pending"}</li>
          <li>Call-hour rules: {readiness.callHourRulesReady ? "ready" : "pending"}</li>
          <li>Twilio certification: {readiness.twilioOutboundCertified ? "certified" : "pending"}</li>
          <li>Schema: {readiness.schemaReady ? "ready" : "pending migration"}</li>
        </ul>
      </div>
    </section>
  )
}
