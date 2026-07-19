"use client"

import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { projectGrowthCanonicalOperatorDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import type { GrowthCanonicalNextBestDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"
import type { GrowthCanonicalDecisionFreshness } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthCanonicalOperatorDecisionProjection } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import { humanizeOperatorBadgeLabel } from "@/lib/growth/aios/operator-experience/growth-operator-language-1a"

function BulletList({ title, lines }: { title: string; lines: string[] }) {
  if (!lines.length) return null
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1 text-sm text-foreground">
        {lines.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>
    </div>
  )
}

export function GrowthCanonicalDecisionCard({
  decision,
  freshness,
  projection,
}: {
  decision?: GrowthCanonicalNextBestDecision | null
  freshness?: GrowthCanonicalDecisionFreshness | null
  projection?: GrowthCanonicalOperatorDecisionProjection | null
}) {
  const projected =
    projection ??
    (decision ? projectGrowthCanonicalOperatorDecision({ decision, freshness }) : null)
  if (!projected) return null

  return (
    <GrowthEngineCard title={projected.headline} subtitle="What Ava needs and why">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground">{projected.whatToDo}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {projected.whenLabel} · {projected.whoActs}
            {projected.whoInvolved ? ` · involves ${projected.whoInvolved}` : ""}
          </p>
        </div>

        <BulletList title="Why" lines={projected.why} />
        {projected.prerequisites.length ? (
          <BulletList title="Must happen first" lines={projected.prerequisites} />
        ) : null}
        {projected.thenActions.length ? <BulletList title="What happens next" lines={projected.thenActions} /> : null}
        {projected.doNotActions.length ? <BulletList title="Hold off on" lines={projected.doNotActions} /> : null}

        <div className="flex flex-wrap gap-2">
          <GrowthBadge label={projected.confidenceLabel} tone="neutral" />
          {projected.freshnessLabel ? (
            <GrowthBadge label={humanizeOperatorBadgeLabel(projected.freshnessLabel)} tone="attention" />
          ) : null}
          {projected.operatorReviewRequired ? (
            <GrowthBadge label="Needs your review" tone="attention" />
          ) : null}
          {projected.transportBlocked ? (
            <GrowthBadge label="Ready for review" tone="neutral" />
          ) : null}
        </div>
      </div>
    </GrowthEngineCard>
  )
}
