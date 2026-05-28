"use client"

import { useState } from "react"
import { Check, HeartPulse, Loader2, ShieldAlert, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { VoiceRetentionIntelligenceWorkspaceSnapshot } from "@/lib/voice/retention-intelligence/types"
import { VOICE_RETENTION_INTELLIGENCE_QA_MARKER } from "@/lib/voice/retention-intelligence/types"

export function GrowthCallWorkspaceRetentionIntelligencePanel({
  retentionIntelligence,
  onRefresh,
}: {
  retentionIntelligence: VoiceRetentionIntelligenceWorkspaceSnapshot | null
  onRefresh?: () => Promise<void>
}) {
  const [actingEventId, setActingEventId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!retentionIntelligence) {
    return (
      <div
        className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground"
        data-voice-retention-intelligence-qa-marker={VOICE_RETENTION_INTELLIGENCE_QA_MARKER}
      >
        <HeartPulse className="mx-auto mb-2 size-4" />
        Retention intelligence appears once relationship memory is linked to this contact.
      </div>
    )
  }

  async function lifecycleAction(eventId: string, action: "acknowledge" | "dismiss" | "resolve") {
    setActingEventId(eventId)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/voice/retention-intelligence/events/${eventId}`, {
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

  const healthTone =
    retentionIntelligence.healthDirection === "improving"
      ? "healthy"
      : retentionIntelligence.healthDirection === "at_risk" || retentionIntelligence.healthDirection === "declining"
        ? "attention"
        : "neutral"

  const riskTone =
    retentionIntelligence.retentionRiskLevel === "low"
      ? "healthy"
      : retentionIntelligence.retentionRiskLevel === "critical" || retentionIntelligence.retentionRiskLevel === "elevated"
        ? "attention"
        : "medium"

  const topRisk = retentionIntelligence.topRisks[0]
  const topExpansion = retentionIntelligence.topExpansionSignals[0]
  const lifecycleEvent = retentionIntelligence.topActiveEvents[0]

  return (
    <div
      className="space-y-3 rounded-xl border border-border/60 bg-card/80 p-3 dark:border-white/5"
      data-voice-retention-intelligence-qa-marker={VOICE_RETENTION_INTELLIGENCE_QA_MARKER}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HeartPulse className="size-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Retention Intelligence</h4>
        </div>
        <GrowthBadge label="Passive · CS assist" tone="neutral" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/50 px-2 py-1.5 dark:border-white/5">
          <p className="text-[10px] uppercase text-muted-foreground">Customer health</p>
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold tabular-nums">{retentionIntelligence.healthScore}</span>
            <GrowthBadge label={retentionIntelligence.healthDirection.replace(/_/g, " ")} tone={healthTone} />
          </div>
        </div>
        <div className="rounded-lg border border-border/50 px-2 py-1.5 dark:border-white/5">
          <p className="text-[10px] uppercase text-muted-foreground">Retention risk</p>
          <GrowthBadge label={retentionIntelligence.retentionRiskLevel.replace(/_/g, " ")} tone={riskTone} />
        </div>
      </div>

      {topRisk ? (
        <div>
          <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ShieldAlert className="size-3" />
            Retention risk
          </p>
          <p className="rounded-md bg-muted/30 px-2 py-1 text-xs">{topRisk.evidenceText.slice(0, 120)}</p>
        </div>
      ) : null}

      {topExpansion ? (
        <div>
          <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-3" />
            Expansion signals
          </p>
          <p className="rounded-md bg-muted/30 px-2 py-1 text-xs">{topExpansion.evidenceText.slice(0, 120)}</p>
        </div>
      ) : null}

      {retentionIntelligence.unresolvedIssues.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Unresolved issues</p>
          <ul className="space-y-1">
            {retentionIntelligence.unresolvedIssues.slice(0, 3).map((issue, index) => (
              <li key={`issue-${index}`} className="rounded-md bg-muted/30 px-2 py-1 text-xs">
                {issue.slice(0, 100)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {retentionIntelligence.whatChangedSinceLastInteraction ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            What changed since last interaction
          </p>
          <p className="rounded-md bg-muted/30 px-2 py-1 text-xs">
            {retentionIntelligence.whatChangedSinceLastInteraction.evidenceText.slice(0, 140)}
          </p>
        </div>
      ) : null}

      {retentionIntelligence.recommendedCustomerSuccessAction ? (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 text-xs">
          <p className="font-medium text-emerald-800 dark:text-emerald-200">Recommended success action</p>
          <p className="text-muted-foreground">{retentionIntelligence.recommendedCustomerSuccessAction}</p>
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
            {actingEventId === lifecycleEvent.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            Acknowledge
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={actingEventId === lifecycleEvent.id} onClick={() => void lifecycleAction(lifecycleEvent.id, "dismiss")}>
            <X className="size-3" />
            Dismiss
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={actingEventId === lifecycleEvent.id} onClick={() => void lifecycleAction(lifecycleEvent.id, "resolve")}>
            Resolve
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <p className="text-[10px] text-muted-foreground">
        Windowed snapshot · {retentionIntelligence.activeEventCount} active events · no autonomous customer updates
      </p>
    </div>
  )
}
