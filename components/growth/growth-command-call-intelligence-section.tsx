"use client"

import type { CallIntelligenceDashboardSummary } from "@/lib/growth/call-intelligence/call-intelligence-types"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"

export function GrowthCommandCallIntelligenceSection({
  summary,
}: {
  summary: CallIntelligenceDashboardSummary
}) {
  return (
    <GrowthEngineCard
      title="Call Intelligence"
      subtitle="Deterministic call scorecards — operator-facing only, no audio replay"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Average call score" value={`${summary.averageCallScore}/100`} />
        <StatTile label="Critical call risks" value={String(summary.criticalCallRisks)} />
        <StatTile label="Calls needing follow-up" value={String(summary.callsNeedingFollowUp)} />
        <StatTile label="Next step missing" value={String(summary.nextStepMissingCount)} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Unresolved objections" value={String(summary.unresolvedObjections)} />
        <StatTile label="Competitor mentions" value={String(summary.competitorMentions)} />
        <StatTile label="Scored calls" value={String(summary.scoredCalls)} />
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Top coaching opportunity
        </p>
        <div className="flex flex-wrap gap-1.5">
          {summary.topCoachingOpportunities.length > 0 ? (
            summary.topCoachingOpportunities.slice(0, 3).map((entry) => (
              <GrowthBadge key={entry.key} tone="attention">
                {entry.label} · {entry.count}
              </GrowthBadge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No scored calls yet</span>
          )}
        </div>
      </div>
    </GrowthEngineCard>
  )
}
