"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, PhoneMissed } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import type { VoiceMissedCallRecoveryReadinessSnapshot } from "@/lib/voice/missed-call-recovery/types"
import { VOICE_MISSED_CALL_RECOVERY_QA_MARKER } from "@/lib/voice/missed-call-recovery/types"

export function GrowthMissedCallRecoveryReadinessSection() {
  const [readiness, setReadiness] = useState<VoiceMissedCallRecoveryReadinessSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/missed-call-recovery/readiness", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { readiness?: VoiceMissedCallRecoveryReadinessSnapshot }
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
      data-voice-missed-call-recovery-qa-marker={VOICE_MISSED_CALL_RECOVERY_QA_MARKER}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <PhoneMissed className="size-4" />
        Missed-Call Recovery Readiness
      </p>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <GrowthBadge
            label={readiness.recoveryEnabled ? "Recovery enabled" : "Recovery disabled"}
            tone={readiness.recoveryEnabled ? "healthy" : "neutral"}
          />
          <GrowthBadge label="Autonomous outbound disabled" tone="neutral" />
          <GrowthBadge label="Operator-initiated callbacks only" tone="neutral" />
        </div>
        <p className="text-xs text-muted-foreground">{readiness.message}</p>
        <ul className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <li>Callback workflow: {readiness.callbackWorkflowReady ? "ready" : "pending"}</li>
          <li>Operator assignment: {readiness.operatorAssignmentReady ? "ready" : "pending"}</li>
          <li>Opt-out registry: {readiness.optOutRegistryReady ? "ready" : "pending"}</li>
          <li>Schema: {readiness.schemaReady ? "ready" : "pending migration"}</li>
          <li>Active recoveries: {readiness.activeRecoveryCount}</li>
          <li>Pending callbacks: {readiness.pendingCallbackCount}</li>
        </ul>
      </div>
    </section>
  )
}
