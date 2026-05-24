"use client"

import { useEffect, useState } from "react"
import { GitBranch } from "lucide-react"
import { GrowthBadge, GrowthActionRequiredBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import { growthLeadSequenceActionRequired } from "@/lib/growth/growth-lead-drawer-badges"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type { GrowthSequencePattern, GrowthSequenceRecommendedNextStep } from "@/lib/growth/sequence-types"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthSequenceIntelligenceProps = {
  lead: GrowthLead
}

function isNextStep(value: GrowthLead["recommendedSequenceNextStep"]): value is GrowthSequenceRecommendedNextStep {
  return typeof value === "object" && value != null && "stepOrder" in value
}

export function GrowthSequenceIntelligence({ lead }: GrowthSequenceIntelligenceProps) {
  const [pattern, setPattern] = useState<GrowthSequencePattern | null>(null)

  useEffect(() => {
    if (!lead.recommendedSequencePatternId) {
      setPattern(null)
      return
    }
    void fetch("/api/platform/growth/sequences/patterns", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { patterns?: GrowthSequencePattern[] }) => {
        const match = data.patterns?.find((entry) => entry.id === lead.recommendedSequencePatternId) ?? null
        setPattern(match)
      })
      .catch(() => setPattern(null))
  }, [lead.recommendedSequencePatternId])

  const nextStep = isNextStep(lead.recommendedSequenceNextStep) ? lead.recommendedSequenceNextStep : null
  const collapsedSummary = [
    pattern?.label ?? null,
    lead.recommendedSequenceConfidence != null ? `${lead.recommendedSequenceConfidence}` : null,
    lead.sequenceFatigueRisk ?? null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <GrowthCollapsibleEngineCard
      title="Sequence Intelligence"
      icon={<GitBranch className="size-4" />}
      headerAside={collapsedSummary || "No sequence recommendation"}
      headerTrailing={growthLeadSequenceActionRequired(lead) ? <GrowthActionRequiredBadge /> : null}
      defaultOpen={false}
      persistKey={GROWTH_DRAWER_CARD_KEYS.sequence}
    >
      <div className="space-y-4">
        {pattern ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{pattern.label}</span>
            <GrowthBadge label={`v${pattern.sequenceVersion}`} tone="neutral" />
            {lead.sequenceFatigueRisk ? (
              <GrowthBadge label={`fatigue ${lead.sequenceFatigueRisk}`} tone="warning" />
            ) : null}
          </div>
        ) : null}

        {lead.recommendedSequenceReason ? (
          <p className="text-sm text-muted-foreground">{lead.recommendedSequenceReason}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No recommended sequence for this lead yet.</p>
        )}

        {lead.recommendedSequenceConfidence != null ? (
          <p className="text-sm">
            Confidence: <span className="font-semibold tabular-nums">{lead.recommendedSequenceConfidence}</span>
          </p>
        ) : null}

        {nextStep ? (
          <div className="rounded-lg border border-border px-3 py-2 text-sm">
            <p className="text-muted-foreground">Next step</p>
            <p className="font-medium capitalize">
              {nextStep.channel.replace(/_/g, " ")}
              {nextStep.generationType ? ` · ${nextStep.generationType.replace(/_/g, " ")}` : ""}
            </p>
            <p className="text-muted-foreground">
              Delay {nextStep.delayDays}d · expect {nextStep.expectedSignal.replace(/_/g, " ")}
              {nextStep.requiredHumanApproval ? " · approval required" : ""}
            </p>
          </div>
        ) : null}

        {pattern ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Metric label="Quality score" value={pattern.sequenceQualityScore} />
            <Metric label="Positive reply rate" value={`${Math.round(pattern.positiveReplyRate * 100)}%`} />
            <Metric label="Abandonment rate" value={`${Math.round(pattern.sequenceAbandonmentRate * 100)}%`} />
            <Metric label="Opp lift" value={pattern.opportunityLift.toFixed(1)} />
            <Metric label="Rev lift" value={pattern.revenueProbabilityLift.toFixed(1)} />
            <Metric label="Conversation lift" value={pattern.conversationHealthLift.toFixed(1)} />
          </div>
        ) : null}

        {pattern && pattern.attemptCount >= 3 ? (
          <p className="text-xs text-muted-foreground">
            Similar wins: {pattern.attemptCount} observed attempts with{" "}
            {Math.round(pattern.meetingSignalRate * 100)}% meeting signals.
          </p>
        ) : null}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2 text-sm">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  )
}
