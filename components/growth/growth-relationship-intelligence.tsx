"use client"

import { ArrowDownRight, ArrowRight, ArrowUpRight, Handshake } from "lucide-react"
import { GrowthBadge, GrowthActionRequiredBadge, GrowthCollapsibleEngineCard, formatRelativeTime } from "@/components/growth/growth-ui-utils"
import { isNativeRevenueDecisionEngineEnabledClient } from "@/lib/growth/contact-verification/native-revenue-decision-feature"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type { GrowthLead } from "@/lib/growth/types"

type GrowthRelationshipIntelligenceProps = {
  lead: GrowthLead
  nativeRelationshipRecommendation?: string | null
}

function trendIcon(trend: GrowthLead["relationshipTrend"]) {
  switch (trend) {
    case "improving":
      return <ArrowUpRight className="size-4 text-emerald-600" />
    case "cooling":
      return <ArrowDownRight className="size-4 text-amber-600" />
    default:
      return <ArrowRight className="size-4 text-muted-foreground" />
  }
}

function trendTone(trend: GrowthLead["relationshipTrend"]): "healthy" | "warning" | "neutral" {
  if (trend === "improving") return "healthy"
  if (trend === "cooling") return "warning"
  return "neutral"
}

function attentionTone(
  level: GrowthLead["relationshipOwnerAttentionLevel"],
): "healthy" | "warning" | "neutral" {
  if (level === "critical") return "warning"
  if (level === "important") return "healthy"
  if (level === "recommended") return "neutral"
  return "neutral"
}

export function GrowthRelationshipIntelligence({
  lead,
  nativeRelationshipRecommendation,
}: GrowthRelationshipIntelligenceProps) {
  const collapsedSummary = [
    lead.relationshipStrengthScore != null ? `${lead.relationshipStrengthScore}` : null,
    lead.relationshipStrengthTier ?? null,
    lead.relationshipTrend ?? null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <GrowthCollapsibleEngineCard
      id="growth-relationship"
      title="Relationship Intelligence"
      icon={<Handshake className="size-4" />}
      headerAside={collapsedSummary || "No relationship data"}
      headerTrailing={growthLeadRelationshipActionRequired(lead) ? <GrowthActionRequiredBadge /> : null}
      defaultOpen={false}
      persistKey={GROWTH_DRAWER_CARD_KEYS.relationship}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {lead.relationshipStrengthScore ?? "—"}
          </span>
          {lead.relationshipStrengthTier ? (
            <GrowthBadge label={lead.relationshipStrengthTier} tone="healthy" />
          ) : null}
          {lead.relationshipTrend ? (
            <span className="inline-flex items-center gap-1">
              {trendIcon(lead.relationshipTrend)}
              <GrowthBadge label={lead.relationshipTrend} tone={trendTone(lead.relationshipTrend)} />
            </span>
          ) : null}
        </div>

        {lead.relationshipOwnerAttentionLevel !== "none" ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Owner attention:</span>
            <GrowthBadge
              label={lead.relationshipOwnerAttentionLevel}
              tone={attentionTone(lead.relationshipOwnerAttentionLevel)}
            />
          </div>
        ) : null}

        {isNativeRevenueDecisionEngineEnabledClient() && nativeRelationshipRecommendation ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Native recommendation
            </p>
            <p className="mt-1 text-foreground">{nativeRelationshipRecommendation}</p>
          </div>
        ) : null}

        {lead.relationshipSummary ? (
          <p className="text-sm text-foreground">{lead.relationshipSummary}</p>
        ) : null}

        {lead.relationshipTopSignals?.length ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Top signals</p>
            <ul className="space-y-1.5">
              {(lead.relationshipTopSignals ?? []).map((signal, index) => (
                <li key={`${signal.kind}-${signal.occurredAt}-${index}`} className="flex justify-between gap-3 text-sm">
                  <span>{signal.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {signal.points > 0 ? "+" : ""}
                    {signal.points}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {lead.relationshipLastMeaningfulTouchAt ? (
          <p className="text-xs text-muted-foreground">
            Last meaningful touch {formatRelativeTime(lead.relationshipLastMeaningfulTouchAt)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No meaningful touches recorded yet.</p>
        )}

        {lead.relationshipRecoveryAttemptCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            Recovery attempts while cooling: {lead.relationshipRecoveryAttemptCount}
          </p>
        ) : null}
      </div>
    </GrowthCollapsibleEngineCard>
  )
}
