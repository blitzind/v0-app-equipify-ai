"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BrainCircuit, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type { MeetingOutcomeLeadView } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"
import { GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthLeadMeetingOutcomeIntelligenceProps = {
  lead: GrowthLead
}

function momentumTone(trend: string): "healthy" | "attention" | "medium" | "neutral" {
  if (trend === "building") return "healthy"
  if (trend === "at_risk") return "attention"
  if (trend === "slipping") return "medium"
  return "neutral"
}

export function GrowthLeadMeetingOutcomeIntelligence({ lead }: GrowthLeadMeetingOutcomeIntelligenceProps) {
  const [view, setView] = useState<MeetingOutcomeLeadView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupMessage, setSetupMessage] = useState<string | null>(null)
  const [recomputing, setRecomputing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/meeting-outcomes`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        meta?: { schemaReady?: boolean; setupMessage?: string }
        leadView?: MeetingOutcomeLeadView | null
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load meeting outcome intelligence.")
      if (data.meta?.schemaReady === false) {
        setSetupMessage(data.meta.setupMessage ?? null)
        setView(null)
        return
      }
      setSetupMessage(null)
      setView(data.leadView ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  useEffect(() => {
    void load()
  }, [load])

  async function recompute() {
    setRecomputing(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/leads/${lead.id}/meeting-outcomes/recompute`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) throw new Error(data.message ?? "Recompute failed.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recompute failed.")
    } finally {
      setRecomputing(false)
    }
  }

  const latest = view?.latestScore

  return (
    <GrowthCollapsibleEngineCard
      id="growth-meeting-outcome-intelligence"
      cardKey={GROWTH_DRAWER_CARD_KEYS.meetingOutcomes}
      title="Meeting Outcome Intelligence"
      subtitle="Deterministic outcome scoring — recommendations only, operator controlled"
      icon={<BrainCircuit className="size-4" />}
      badges={[
        { label: GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER, tone: "healthy" },
        { label: "No auto-send · scheduling · CRM", tone: "neutral" },
      ]}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading meeting outcome intelligence…
        </div>
      ) : setupMessage ? (
        <p className="text-sm text-muted-foreground">{setupMessage}</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !latest ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">No meeting outcomes scored yet.</p>
          <Button type="button" size="sm" variant="outline" disabled={recomputing} onClick={() => void recompute()}>
            {recomputing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Recompute
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge label={`Outcome ${latest.meetingOutcomeScore}/100`} tone="healthy" />
            <GrowthBadge label={`Quality ${latest.meetingQualityScore}/100`} tone="medium" />
            <GrowthBadge
              label={latest.momentumTrendLabel}
              tone={momentumTone(latest.momentumTrend)}
            />
            <GrowthBadge label={latest.followUpRecommendationLabel} tone="attention" />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border/80 p-3">
              <p className="text-xs text-muted-foreground">Outcome confidence</p>
              <p className="text-sm font-medium">{latest.nextStepConfidence}/100</p>
            </div>
            <div className="rounded-lg border border-border/80 p-3">
              <p className="text-xs text-muted-foreground">Buying signals / objections</p>
              <p className="text-sm font-medium">
                {latest.buyingSignalCount} signals · {latest.objectionCount} objections
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">{latest.recommendedNextStep}</p>

          {latest.championDetected || latest.decisionMakerPresent ? (
            <div className="flex flex-wrap gap-2">
              {latest.championDetected ? <GrowthBadge label="Champion detected" tone="healthy" /> : null}
              {latest.decisionMakerPresent ? (
                <GrowthBadge label="Decision maker present" tone="healthy" />
              ) : null}
              {latest.budgetSignal ? <GrowthBadge label="Budget signal" tone="medium" /> : null}
              {latest.timelineDetected ? <GrowthBadge label="Timeline detected" tone="medium" /> : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={recomputing} onClick={() => void recompute()}>
              {recomputing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Recompute
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/admin/growth/leads?open=${lead.id}&focus=meetings`}>Open meetings</Link>
            </Button>
          </div>
        </div>
      )}
    </GrowthCollapsibleEngineCard>
  )
}
