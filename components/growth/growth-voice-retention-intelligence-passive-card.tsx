"use client"

import { useCallback, useEffect, useState } from "react"
import { HeartPulse, Loader2 } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { VoiceRetentionIntelligenceWorkspaceSnapshot } from "@/lib/voice/retention-intelligence/types"
import { VOICE_RETENTION_INTELLIGENCE_QA_MARKER } from "@/lib/voice/retention-intelligence/types"

type GrowthVoiceRetentionIntelligencePassiveCardProps = {
  leadId?: string | null
  phoneNumber?: string | null
  compact?: boolean
}

export function GrowthVoiceRetentionIntelligencePassiveCard({
  leadId,
  phoneNumber,
  compact = false,
}: GrowthVoiceRetentionIntelligencePassiveCardProps) {
  const [snapshot, setSnapshot] = useState<VoiceRetentionIntelligenceWorkspaceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!leadId && !phoneNumber) {
      setSnapshot(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (leadId) params.set("leadId", leadId)
      if (phoneNumber) params.set("phoneNumber", phoneNumber)
      const res = await fetch(`/api/platform/growth/voice/retention-intelligence/snapshot?${params}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        snapshot?: VoiceRetentionIntelligenceWorkspaceSnapshot | null
      }
      if (res.ok) setSnapshot(data.snapshot ?? null)
    } finally {
      setLoading(false)
    }
  }, [leadId, phoneNumber])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Loading retention intelligence…
      </div>
    )
  }

  if (!snapshot) return null

  return (
    <div
      className="space-y-2 rounded-md border border-border/50 bg-muted/10 px-3 py-2"
      data-voice-retention-intelligence-qa-marker={VOICE_RETENTION_INTELLIGENCE_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <HeartPulse className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Voice retention intelligence</span>
        <GrowthBadge label="Passive" tone="neutral" />
      </div>
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Health</p>
          <p className="text-xs font-semibold tabular-nums">{snapshot.healthScore}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Risk</p>
          <p className="text-xs font-semibold capitalize">{snapshot.retentionRiskLevel.replace(/_/g, " ")}</p>
        </div>
        {!compact ? (
          <>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Direction</p>
              <p className="text-xs font-semibold capitalize">{snapshot.healthDirection.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Expansion</p>
              <p className="text-xs font-semibold tabular-nums">{snapshot.topExpansionSignals.length}</p>
            </div>
          </>
        ) : null}
      </div>
      {snapshot.recommendedCustomerSuccessAction ? (
        <p className="text-xs text-muted-foreground">
          {snapshot.recommendedCustomerSuccessAction.slice(0, compact ? 100 : 160)}
        </p>
      ) : null}
    </div>
  )
}
