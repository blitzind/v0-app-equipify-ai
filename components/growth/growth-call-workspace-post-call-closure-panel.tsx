"use client"

import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthCanonicalDecisionCard } from "@/components/growth/growth-canonical-decision-card"
import type { GrowthCallWorkspacePostCallClosure } from "@/lib/growth/operator-assist/call-workspace-post-call-closure-types"

function BulletSection({ title, lines }: { title: string; lines: string[] }) {
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

export function GrowthCallWorkspacePostCallClosurePanel({
  closure,
  loading,
}: {
  closure: GrowthCallWorkspacePostCallClosure | null
  loading?: boolean
}) {
  if (loading) {
    return (
      <GrowthEngineCard title="What Ava heard" subtitle="Synthesizing call outcome — not a transcript review">
        <p className="text-sm text-muted-foreground">Preparing post-call closure…</p>
      </GrowthEngineCard>
    )
  }

  if (!closure) return null

  return (
    <GrowthEngineCard
      title="What Ava heard"
      subtitle="Conclusions from the call — operator can correct before confirming wrap-up"
    >
      <div className="space-y-4">
        <p className="text-sm">{closure.meetingSummary}</p>

        <BulletSection title="Confirmed business problem" lines={closure.businessConclusions} />
        <BulletSection title="Objections" lines={closure.objections} />
        <BulletSection title="Buying signals" lines={closure.buyingSignals} />
        <BulletSection title="Stakeholders mentioned" lines={closure.committeeSignals} />
        <BulletSection title="Commitments made" lines={closure.commitments} />

        {closure.strategyChange?.meaningfulChanges.length ? (
          <BulletSection title="Strategy change" lines={closure.strategyChange.meaningfulChanges} />
        ) : null}

        {closure.relationshipChange.length ? (
          <BulletSection
            title="Relationship change"
            lines={closure.relationshipChange.map((event) => event.summary)}
          />
        ) : null}

        <GrowthCanonicalDecisionCard
          decision={closure.canonicalDecision}
        />

        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 dark:border-white/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended next action</p>
          <p className="mt-1 text-sm font-medium">{closure.recommendedNextAction.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{closure.recommendedNextAction.rationale}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {closure.followUpRequired ? (
            <GrowthBadge label={`Follow-up: ${closure.followUpChannel ?? "package"}`} tone="attention" />
          ) : (
            <GrowthBadge label="No follow-up package required" tone="neutral" />
          )}
          {closure.followUpPackageStatus === "pending_approval" ? (
            <GrowthBadge label="Package in Human Approval Center" tone="attention" />
          ) : null}
          {closure.operatorReviewRequired ? (
            <GrowthBadge label="Memory or committee review required" tone="attention" />
          ) : null}
          <GrowthBadge label="Send Plane blocked" tone="neutral" />
        </div>

        {closure.memoryReviewItems.length ? (
          <BulletSection
            title="Memory items requiring review"
            lines={closure.memoryReviewItems.map((row) => `${row.conclusion} (${row.confidence})`)}
          />
        ) : null}
      </div>
    </GrowthEngineCard>
  )
}
