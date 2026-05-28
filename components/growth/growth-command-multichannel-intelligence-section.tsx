"use client"

import { useCallback, useEffect, useState } from "react"
import { Layers } from "lucide-react"
import Link from "next/link"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { VoiceMultichannelIntelligenceCommandSummary } from "@/lib/voice/multi-channel-intelligence/types"
import { VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER } from "@/lib/voice/multi-channel-intelligence/types"

export function GrowthCommandMultichannelIntelligenceSection() {
  const [summary, setSummary] = useState<VoiceMultichannelIntelligenceCommandSummary | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/platform/growth/voice/multichannel-intelligence/command-summary", { cache: "no-store" })
    const data = (await res.json().catch(() => ({}))) as { summary?: VoiceMultichannelIntelligenceCommandSummary }
    if (res.ok && data.summary) setSummary(data.summary)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!summary) return null

  const hasActivity =
    summary.activeThreadCount > 0 ||
    summary.escalatedCount > 0 ||
    summary.stalledCount > 0 ||
    summary.unresolvedIssueCount > 0

  if (!hasActivity) return null

  return (
    <GrowthEngineCard
      id="cc-multichannel-intelligence"
      icon={Layers}
      title="Unified Communications"
      subtitle="Cross-channel intelligence — operator-controlled, no autonomous campaigns."
      data-voice-multichannel-intelligence-qa-marker={VOICE_MULTICHANNEL_INTELLIGENCE_QA_MARKER}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <GrowthBadge label="Visibility only" tone="neutral" />
        <GrowthBadge label="No auto-send" tone="neutral" />
        {summary.fatigueWarningCount > 0 ? (
          <GrowthBadge label={`${summary.fatigueWarningCount} fatigue warnings`} tone="attention" />
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active threads" value={String(summary.activeThreadCount)} />
        <StatTile label="Escalated" value={String(summary.escalatedCount)} />
        <StatTile label="Stalled" value={String(summary.stalledCount)} />
        <StatTile label="Unresolved issues" value={String(summary.unresolvedIssueCount)} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        <Link href="/admin/growth/settings/voice" className="underline underline-offset-2">
          Open voice settings
        </Link>{" "}
        to review unified communication timelines and preferred channel insights.
      </p>
    </GrowthEngineCard>
  )
}
