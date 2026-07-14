"use client"

import { Badge } from "@/components/ui/badge"
import type { GrowthClosedLoopLearningReadModel } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import { GROWTH_CLOSED_LOOP_LEARNING_QA_MARKER } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"

type Props = {
  closedLoopLearning: GrowthClosedLoopLearningReadModel
}

function statusVariant(status: string) {
  if (status === "advisory") return "secondary" as const
  if (status === "needs_review") return "outline" as const
  return "outline" as const
}

export function GrowthAiOsClosedLoopLearningSection({ closedLoopLearning }: Props) {
  if (closedLoopLearning.qaMarker !== GROWTH_CLOSED_LOOP_LEARNING_QA_MARKER) return null

  const topInsights = closedLoopLearning.insights.slice(0, 4)
  const recentOutcomes = closedLoopLearning.outcomes.slice(0, 6)

  return (
    <section
      data-qa-section="closed-loop-learning"
      className="space-y-3 rounded-lg border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Closed-Loop Learning</h3>
          <p className="text-xs text-muted-foreground">
            Read-only outcome observation and advisory insights — no automatic policy or score changes.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {closedLoopLearning.persistenceMode === "durable"
            ? "Durable store"
            : closedLoopLearning.schemaReady
              ? "Schema ready"
              : "Schema pending"}
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Outcomes observed</p>
          <p className="text-sm font-medium">{closedLoopLearning.summary.outcomesObserved}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Insights generated</p>
          <p className="text-sm font-medium">{closedLoopLearning.summary.insightsGenerated}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Avg confidence</p>
          <p className="text-sm font-medium">
            {Math.round(closedLoopLearning.summary.averageConfidence * 100)}%
          </p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Last generated</p>
          <p className="text-sm font-medium">
            {closedLoopLearning.lastGeneratedAt
              ? new Date(closedLoopLearning.lastGeneratedAt).toLocaleString()
              : "—"}
          </p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Store mode</p>
          <p className="text-sm font-medium">{closedLoopLearning.persistenceMode.replace(/_/g, " ")}</p>
        </div>
      </div>

      {topInsights.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">What Ava has learned</p>
          {topInsights
            .filter((insight) => insight.status === "advisory")
            .slice(0, 3)
            .map((insight) => (
              <p key={`learned-${insight.id}`} className="text-sm text-muted-foreground">
                {insight.summary}
              </p>
            ))}
          <p className="text-xs font-medium text-muted-foreground pt-1">Top insights</p>
          {topInsights.map((insight) => (
            <div key={insight.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{insight.title}</p>
                <Badge variant={statusVariant(insight.status)}>{insight.status.replace(/_/g, " ")}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{insight.summary}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Sample: {insight.sampleSize}</span>
                <span>Confidence: {Math.round(insight.confidence * 100)}%</span>
                <span>Target: {insight.targetSystem.replace(/_/g, " ")}</span>
                <span>Adjustment: {insight.recommendedAdjustment.replace(/_/g, " ")}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {recentOutcomes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Recent outcomes</p>
          <div className="space-y-1">
            {recentOutcomes.map((outcome) => (
              <div
                key={outcome.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-dashed px-2 py-1 text-xs"
              >
                <span>
                  {outcome.source.replace(/_/g, " ")} · {outcome.outcomeType.replace(/_/g, " ")}
                </span>
                <span className="text-muted-foreground">
                  {outcome.subject.type}:{outcome.subject.id.slice(0, 8)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
