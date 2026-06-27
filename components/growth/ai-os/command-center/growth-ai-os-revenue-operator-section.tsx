"use client"

import { Crown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_REVENUE_OPERATOR_ORCHESTRATION_QA_MARKER,
  type RevenueOperatorReadModel,
} from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"

export function GrowthAiOsRevenueOperatorSection({
  revenueOperator,
}: {
  revenueOperator: RevenueOperatorReadModel
}) {
  return (
    <Card
      data-qa-marker={GROWTH_REVENUE_OPERATOR_ORCHESTRATION_QA_MARKER}
      data-qa-section="revenue-operator"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Crown className="size-5 text-amber-600" />
          Revenue Operator
        </CardTitle>
        <CardDescription>{revenueOperator.rule}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <p className="font-medium">
            Supervisor: {revenueOperator.supervisorAgent.replaceAll("_", " ")} ·{" "}
            {revenueOperator.summary.leadsEvaluated} lead(s) evaluated · Scheduler{" "}
            {revenueOperator.schedulerActive ? "active" : "inactive"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Human review: {revenueOperator.summary.humanReviewRequired} · Blocked:{" "}
            {revenueOperator.summary.blocked} · Execution ready:{" "}
            {revenueOperator.summary.executionReady}
          </p>
        </div>

        {revenueOperator.metaRecommenderBinding ? (
          <p className="text-xs text-muted-foreground">{revenueOperator.metaRecommenderBinding.summary}</p>
        ) : null}

        {revenueOperator.priorityEngineBinding ? (
          <p className="text-xs text-muted-foreground">{revenueOperator.priorityEngineBinding.summary}</p>
        ) : null}

        {revenueOperator.orchestrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orchestration evaluations yet.</p>
        ) : (
          <div className="space-y-3">
            {revenueOperator.orchestrations.map((row) => (
              <div key={row.orchestrationId} className="rounded-lg border border-border/70 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{row.companyName ?? row.leadId}</p>
                    <p className="text-xs text-muted-foreground">
                      Stage: {row.currentLifecycleStage.replaceAll("_", " ")} ·{" "}
                      {row.orchestrationDecision.replaceAll("_", " ")}
                    </p>
                  </div>
                  <Badge variant="outline">{Math.round(row.confidence * 100)}% confidence</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    Owner: {row.owningAgent.replaceAll("_", " ")}
                  </Badge>
                  <Badge variant="outline">
                    Next: {row.recommendedNextAgent.replaceAll("_", " ")}
                  </Badge>
                  <Badge variant="outline">
                    Escalation: {row.escalationLevel}
                  </Badge>
                </div>
                <p className="mt-2 text-muted-foreground">{row.reasoning}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Recommended: {row.recommendedNextAction}
                </p>
                {row.blockedReasons.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-800">
                    Blocked: {row.blockedReasons.join(" · ")}
                  </p>
                ) : null}
                {row.handoffPreview ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Handoff preview: {row.handoffPreview.sourceAgent.replaceAll("_", " ")} →{" "}
                    {row.handoffPreview.destinationAgent.replaceAll("_", " ")} — {row.handoffPreview.reason}
                  </p>
                ) : null}
                {row.priorityBinding?.bindingId ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Priority binding: rank {row.priorityBinding.priorityRank ?? "—"} · score{" "}
                    {row.priorityBinding.priorityScore ?? "—"} ·{" "}
                    {row.priorityBinding.recommendedNextStep?.replaceAll("_", " ") ?? "—"}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
