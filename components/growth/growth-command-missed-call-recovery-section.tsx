"use client"

import { useCallback, useEffect, useState } from "react"
import { PhoneMissed } from "lucide-react"
import Link from "next/link"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { VoiceMissedCallRecoveryCommandSummary } from "@/lib/voice/missed-call-recovery/types"
import { VOICE_MISSED_CALL_RECOVERY_QA_MARKER } from "@/lib/voice/missed-call-recovery/types"

export function GrowthCommandMissedCallRecoverySection() {
  const [summary, setSummary] = useState<VoiceMissedCallRecoveryCommandSummary | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/platform/growth/voice/missed-call-recovery/command-summary", { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as { summary?: VoiceMissedCallRecoveryCommandSummary }
    if (res.ok && data.summary) setSummary(data.summary)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!summary || summary.activeCount === 0) return null

  return (
    <GrowthEngineCard
      id="cc-missed-call-recovery"
      icon={PhoneMissed}
      title="Missed-Call Recovery"
      subtitle="Operator-initiated callbacks — no autonomous outbound."
      data-voice-missed-call-recovery-qa-marker={VOICE_MISSED_CALL_RECOVERY_QA_MARKER}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <GrowthBadge label="Approval-based follow-up" tone="neutral" />
        <GrowthBadge label="No auto-dial" tone="neutral" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active recoveries" value={String(summary.activeCount)} />
        <StatTile label="Callbacks due" value={String(summary.callbackDueCount)} />
        <StatTile label="Voicemail left" value={String(summary.voicemailLeftCount)} />
        <StatTile label="Abandoned AI calls" value={String(summary.abandonedReceptionistCount)} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        <Link href="/admin/growth/calls/workspace" className="underline underline-offset-2">
          Open call workspace
        </Link>{" "}
        to review handoff summaries and initiate callbacks manually.
      </p>
    </GrowthEngineCard>
  )
}
