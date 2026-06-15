"use client"

import { Clock, GitBranch, Route, ShieldAlert } from "lucide-react"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { SequenceEnrollmentBranchVisibilityView } from "@/lib/growth/sequences/conditions/sequence-enrollment-branch-visibility-types"
import { channelEventKindLabel } from "@/lib/growth/sequence-orchestration/sequence-multi-channel-state-types"

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

const DECISION_TONE: Record<string, "healthy" | "attention" | "medium" | "neutral" | "blocked"> = {
  true: "healthy",
  false: "medium",
  timeout: "attention",
  skipped: "neutral",
}

export function GrowthSequenceBranchAuditPanel({
  branchVisibility,
}: {
  branchVisibility: SequenceEnrollmentBranchVisibilityView | null | undefined
}) {
  if (!branchVisibility?.hasConditionalGraph) {
    return (
      <GrowthEngineCard title="Branch & Wait Audit" icon={<GitBranch className="size-4" />}>
        <p className="text-sm text-muted-foreground">
          No conditional branch graph or audit events recorded for this enrollment yet.
        </p>
      </GrowthEngineCard>
    )
  }

  return (
    <div className="space-y-4">
      <GrowthEngineCard title="Branch & Wait Audit" icon={<GitBranch className="size-4" />}>
        <div className="mb-4 flex flex-wrap gap-2">
          <GrowthBadge label={branchVisibility.qaMarker} tone="neutral" />
          <GrowthBadge label="Read-only operator view" tone="neutral" />
          {branchVisibility.activeWaits.length > 0 ? (
            <GrowthBadge label={`${branchVisibility.activeWaits.length} active wait(s)`} tone="attention" />
          ) : null}
          {branchVisibility.blockedAdvancementCount > 0 ? (
            <GrowthBadge
              label={`${branchVisibility.blockedAdvancementCount} blocked advancement`}
              tone="blocked"
            />
          ) : null}
        </div>

        {branchVisibility.activeWaits.length > 0 ? (
          <section className="mb-6">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Clock className="size-4" />
              Current wait state
            </h3>
            <ul className="space-y-2">
              {branchVisibility.activeWaits.map((wait) => (
                <li key={wait.id} className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthBadge label={wait.status} tone="attention" />
                    <span className="font-medium">{wait.waitedForEvent ?? wait.waitKind}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Started {formatWhen(wait.startedAt)}
                    {wait.timeoutAt ? ` · timeout ${formatWhen(wait.timeoutAt)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {branchVisibility.branchDecisions.length > 0 ? (
          <section className="mb-6">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Route className="size-4" />
              Branch decisions
            </h3>
            <ul className="space-y-2">
              {branchVisibility.branchDecisions.map((decision) => (
                <li key={decision.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthBadge
                      label={decision.decision}
                      tone={DECISION_TONE[decision.decision] ?? "neutral"}
                    />
                    <span className="text-muted-foreground">
                      {decision.source}.{decision.event}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatWhen(decision.evaluatedAt)}</span>
                  </div>
                  {decision.outcomeDetail ? (
                    <p className="mt-1 text-muted-foreground">{decision.outcomeDetail}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {branchVisibility.skippedSteps.length > 0 ? (
          <section className="mb-6">
            <h3 className="mb-2 text-sm font-medium">Skipped branch paths</h3>
            <ul className="space-y-2">
              {branchVisibility.skippedSteps.map((step) => (
                <li key={step.enrollmentStepId} className="rounded-lg border border-border/80 px-3 py-2 text-sm">
                  <span className="font-medium">
                    Step {step.stepOrder} · {step.channel}
                  </span>
                  {step.skipReason ? (
                    <p className="mt-1 text-muted-foreground">{step.skipReason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {branchVisibility.evidenceRefs.length > 0 ? (
          <section className="mb-6">
            <h3 className="mb-2 text-sm font-medium">Evidence refs</h3>
            <ul className="flex flex-wrap gap-2">
              {branchVisibility.evidenceRefs.map((ref) => (
                <li key={ref}>
                  <GrowthBadge label={ref} tone="neutral" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </GrowthEngineCard>

      <GrowthEngineCard title="Branch / Wait Timeline" icon={<ShieldAlert className="size-4" />}>
        {branchVisibility.timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No branch or wait channel events recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {branchVisibility.timeline.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{entry.title}</span>
                  <span className="text-xs text-muted-foreground">{formatWhen(entry.occurredAt)}</span>
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {channelEventKindLabel(entry.eventKind as never)}
                </p>
                {entry.summary ? <p className="mt-1 text-muted-foreground">{entry.summary}</p> : null}
                {entry.evidenceRefs.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Evidence: {entry.evidenceRefs.join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>
    </div>
  )
}
