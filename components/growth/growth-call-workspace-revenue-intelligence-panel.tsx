"use client"

import { useState } from "react"
import { Check, Loader2, TrendingDown, TrendingUp, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { VoiceRevenueIntelligenceWorkspaceSnapshot } from "@/lib/voice/revenue-intelligence/types"
import { VOICE_REVENUE_INTELLIGENCE_QA_MARKER } from "@/lib/voice/revenue-intelligence/types"

export function GrowthCallWorkspaceRevenueIntelligencePanel({
  revenueIntelligence,
  onRefresh,
}: {
  revenueIntelligence: VoiceRevenueIntelligenceWorkspaceSnapshot | null
  onRefresh?: () => Promise<void>
}) {
  const [actingEventId, setActingEventId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!revenueIntelligence) {
    return (
      <div
        className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground"
        data-voice-revenue-intelligence-qa-marker={VOICE_REVENUE_INTELLIGENCE_QA_MARKER}
      >
        <Zap className="mx-auto mb-2 size-4" />
        Revenue intelligence appears once relationship memory is linked to this contact.
      </div>
    )
  }

  async function lifecycleAction(eventId: string, action: "acknowledge" | "dismiss" | "resolve") {
    setActingEventId(eventId)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/voice/revenue-intelligence/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Lifecycle action failed.")
      await onRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lifecycle action failed.")
    } finally {
      setActingEventId(null)
    }
  }

  const momentumTone =
    revenueIntelligence.momentumDirection === "accelerating"
      ? "healthy"
      : revenueIntelligence.momentumDirection === "decelerating" || revenueIntelligence.momentumDirection === "reversing"
        ? "attention"
        : "neutral"

  const followUpTone =
    revenueIntelligence.followUpHealth.status === "healthy"
      ? "healthy"
      : revenueIntelligence.followUpHealth.status === "overdue"
        ? "attention"
        : "medium"

  const topRisk = revenueIntelligence.topRisks[0]
  const topSignal = revenueIntelligence.topBuyingSignals[0]
  const lifecycleEvent = revenueIntelligence.topActiveEvents[0]

  return (
    <div
      className="space-y-3 rounded-xl border border-border/60 bg-card/80 p-3 dark:border-white/5"
      data-voice-revenue-intelligence-qa-marker={VOICE_REVENUE_INTELLIGENCE_QA_MARKER}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Revenue Intelligence</h4>
        </div>
        <GrowthBadge label="Passive · evidence-backed" tone="neutral" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/50 px-2 py-1.5 dark:border-white/5">
          <p className="text-[10px] uppercase text-muted-foreground">Buying stage</p>
          <p className="text-xs font-semibold capitalize">{revenueIntelligence.currentBuyingStage.replace(/_/g, " ")}</p>
        </div>
        <div className="rounded-lg border border-border/50 px-2 py-1.5 dark:border-white/5">
          <p className="text-[10px] uppercase text-muted-foreground">Momentum</p>
          <div className="flex items-center gap-1">
            {revenueIntelligence.momentumDirection === "accelerating" ? (
              <TrendingUp className="size-3 text-emerald-600" />
            ) : revenueIntelligence.momentumDirection === "decelerating" ||
              revenueIntelligence.momentumDirection === "reversing" ? (
              <TrendingDown className="size-3 text-amber-600" />
            ) : null}
            <GrowthBadge label={revenueIntelligence.momentumDirection.replace(/_/g, " ")} tone={momentumTone} />
          </div>
        </div>
      </div>

      {revenueIntelligence.stageMovement && revenueIntelligence.stageMovement.direction !== "stable" ? (
        <div className="rounded-md bg-muted/30 px-2 py-1.5 text-xs">
          <p className="font-medium">Stage movement</p>
          <p className="text-muted-foreground">
            {revenueIntelligence.stageMovement.fromStage.replace(/_/g, " ")} →{" "}
            {revenueIntelligence.stageMovement.toStage.replace(/_/g, " ")} ({revenueIntelligence.stageMovement.direction})
          </p>
        </div>
      ) : null}

      {topRisk ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Deal risks</p>
          <p className="rounded-md bg-muted/30 px-2 py-1 text-xs">{topRisk.evidenceText.slice(0, 120)}</p>
        </div>
      ) : null}

      {topSignal ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Buying signals</p>
          <p className="rounded-md bg-muted/30 px-2 py-1 text-xs">{topSignal.evidenceText.slice(0, 120)}</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Follow-up health</span>
        <GrowthBadge label={revenueIntelligence.followUpHealth.status.replace(/_/g, " ")} tone={followUpTone} />
      </div>
      <p className="text-xs text-muted-foreground">{revenueIntelligence.followUpHealth.summary}</p>

      {revenueIntelligence.whatChangedSinceLastCall ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            What changed since last call
          </p>
          <p className="rounded-md bg-muted/30 px-2 py-1 text-xs">
            {revenueIntelligence.whatChangedSinceLastCall.evidenceText.slice(0, 140)}
          </p>
        </div>
      ) : null}

      {revenueIntelligence.nextRecommendedOperatorAction ? (
        <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5 text-xs">
          <p className="font-medium text-cyan-800 dark:text-cyan-200">Recommended next revenue action</p>
          <p className="text-muted-foreground">{revenueIntelligence.nextRecommendedOperatorAction}</p>
        </div>
      ) : null}

      {lifecycleEvent ? (
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={actingEventId === lifecycleEvent.id}
            onClick={() => void lifecycleAction(lifecycleEvent.id, "acknowledge")}
          >
            {actingEventId === lifecycleEvent.id ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            Acknowledge
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={actingEventId === lifecycleEvent.id}
            onClick={() => void lifecycleAction(lifecycleEvent.id, "dismiss")}
          >
            <X className="size-3" />
            Dismiss
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={actingEventId === lifecycleEvent.id}
            onClick={() => void lifecycleAction(lifecycleEvent.id, "resolve")}
          >
            Resolve
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <p className="text-[10px] text-muted-foreground">
        Windowed snapshot · {revenueIntelligence.activeEventCount} active events · no autonomous CRM updates
      </p>
    </div>
  )
}
