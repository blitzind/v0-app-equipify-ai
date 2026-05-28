"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import type { VoiceComplianceReadinessSnapshot } from "@/lib/voice/compliance-orchestration/types"
import { VOICE_COMPLIANCE_ORCHESTRATION_QA_MARKER } from "@/lib/voice/compliance-orchestration/types"

export function GrowthComplianceOrchestrationReadinessSection() {
  const [readiness, setReadiness] = useState<VoiceComplianceReadinessSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/compliance/readiness", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { readiness?: VoiceComplianceReadinessSnapshot }
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
      data-voice-compliance-orchestration-qa-marker={VOICE_COMPLIANCE_ORCHESTRATION_QA_MARKER}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="size-4" />
        Compliance + Consent Orchestration
      </p>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge
            label={readiness.orchestrationEnabled ? "Orchestration enabled" : "Orchestration disabled"}
            tone={readiness.orchestrationEnabled ? "healthy" : "neutral"}
          />
          <GrowthBadge label="Conservative default" tone="neutral" />
          <GrowthBadge label="Autonomous outbound disabled" tone="neutral" />
        </div>
        <p className="text-xs text-muted-foreground">{readiness.message}</p>
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <li>Consent readiness: {readiness.consentReadiness ? "ready" : "pending"}</li>
          <li>Suppression entries: {readiness.suppressionCount}</li>
          <li>DNC entries: {readiness.dncCount}</li>
          <li>Opt-outs: {readiness.optOutCount}</li>
          <li>Manual review queue: {readiness.manualReviewQueueCount}</li>
          <li>Call-hour rules: {readiness.callHourRulesReady ? "ready" : "pending"}</li>
          <li>Audit events: {readiness.auditEventCount}</li>
          <li>Schema: {readiness.schemaReady ? "ready" : "pending migration"}</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Not legal advice. Unknown consent or DNC routes to manual review — never auto-send.
        </p>
      </div>
    </section>
  )
}
