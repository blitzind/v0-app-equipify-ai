"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Zap } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { VoiceRevenueIntelligenceWorkspaceSnapshot } from "@/lib/voice/revenue-intelligence/types"
import { VOICE_REVENUE_INTELLIGENCE_QA_MARKER } from "@/lib/voice/revenue-intelligence/types"

type GrowthVoiceRevenueIntelligencePassiveCardProps = {
  leadId?: string | null
  phoneNumber?: string | null
  compact?: boolean
}

export function GrowthVoiceRevenueIntelligencePassiveCard({
  leadId,
  phoneNumber,
  compact = false,
}: GrowthVoiceRevenueIntelligencePassiveCardProps) {
  const [snapshot, setSnapshot] = useState<VoiceRevenueIntelligenceWorkspaceSnapshot | null>(null)
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
      const res = await fetch(`/api/platform/growth/voice/revenue-intelligence/snapshot?${params}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        snapshot?: VoiceRevenueIntelligenceWorkspaceSnapshot | null
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
        Loading revenue intelligence…
      </div>
    )
  }

  if (!snapshot) return null

  return (
    <div
      className="space-y-2 rounded-md border border-border/50 bg-muted/10 px-3 py-2"
      data-voice-revenue-intelligence-qa-marker={VOICE_REVENUE_INTELLIGENCE_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Zap className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Voice revenue intelligence</span>
        <GrowthBadge label="Passive" tone="neutral" />
      </div>
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Stage</p>
          <p className="text-xs font-semibold capitalize">{snapshot.currentBuyingStage.replace(/_/g, " ")}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-muted-foreground">Momentum</p>
          <p className="text-xs font-semibold capitalize">{snapshot.momentumDirection.replace(/_/g, " ")}</p>
        </div>
        {!compact ? (
          <>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Risk score</p>
              <p className="text-xs font-semibold tabular-nums">{snapshot.riskScore}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Follow-up</p>
              <p className="text-xs font-semibold capitalize">{snapshot.followUpHealth.status.replace(/_/g, " ")}</p>
            </div>
          </>
        ) : null}
      </div>
      {snapshot.nextRecommendedOperatorAction ? (
        <p className="text-xs text-muted-foreground">{snapshot.nextRecommendedOperatorAction.slice(0, compact ? 100 : 160)}</p>
      ) : null}
    </div>
  )
}
