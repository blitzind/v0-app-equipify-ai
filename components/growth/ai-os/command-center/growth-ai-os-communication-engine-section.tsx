"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import type { GrowthCommunicationEngineReadModel } from "@/lib/growth/aios/communication/growth-communication-engine-types"
import { GROWTH_COMMUNICATION_ENGINE_QA_MARKER } from "@/lib/growth/aios/communication/growth-communication-engine-types"

type Props = {
  communicationEngine: GrowthCommunicationEngineReadModel
  compact?: boolean
}

export function GrowthAiOsCommunicationEngineSection({ communicationEngine, compact }: Props) {
  if (communicationEngine.qaMarker !== GROWTH_COMMUNICATION_ENGINE_QA_MARKER) return null

  const topPlan = communicationEngine.plans[0]

  return (
    <section
      data-qa-section="communication-engine"
      className="space-y-3 rounded-lg border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Communication Engine</h3>
          <p className="text-xs text-muted-foreground">
            Read-only channel strategy — plans routes and fallbacks without sending.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {communicationEngine.summary.plansGenerated} plan(s)
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Top strategy</p>
          <p className="text-sm font-medium">
            {communicationEngine.summary.primaryStrategy?.replace(/_/g, " ") ?? "—"}
          </p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Channel mix</p>
          <p className="text-sm font-medium">{communicationEngine.summary.topChannel ?? "—"}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Blocked channels</p>
          <p className="text-sm font-medium">{communicationEngine.summary.blockedChannelCount}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Confidence</p>
          <p className="text-sm font-medium">{communicationEngine.summary.averageConfidence}%</p>
        </div>
      </div>

      {communicationEngine.learningAdvisory?.advisoryNote ? (
        <div className="rounded-md border border-dashed border-emerald-200 bg-emerald-50/30 p-3 text-xs text-muted-foreground">
          {communicationEngine.learningAdvisory.advisoryNote}
          {communicationEngine.learningAdvisory.channelComparison ? (
            <span className="ml-2 font-medium text-foreground">
              ({communicationEngine.learningAdvisory.channelComparison})
            </span>
          ) : null}
        </div>
      ) : null}

      {topPlan ? (
        <div className="rounded-md border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                {topPlan.subject.type}:{topPlan.subject.id}
              </p>
              <p className="text-xs text-muted-foreground">
                {topPlan.recommendedStrategy.replace(/_/g, " ")} · {topPlan.steps.length} step(s)
              </p>
            </div>
            <Badge variant="secondary">Conf {topPlan.confidence}</Badge>
          </div>
          {!compact ? (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {topPlan.steps.slice(0, 4).map((step) => (
                <li key={step.stepNumber}>
                  Step {step.stepNumber}: {step.channel} — {step.actionType.replace(/_/g, " ")}
                  {step.requiresHumanApproval ? " · approval required" : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {topPlan.policy.blockedChannels.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Blocked:{" "}
              {topPlan.policy.blockedChannels.map((row) => row.channel).join(", ")}
            </p>
          ) : null}
          {topPlan.routeHints[0] ? (
            <Link
              href={topPlan.routeHints[0].href}
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              {topPlan.routeHints[0].label}
            </Link>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No communication plans in the current read model.</p>
      )}
    </section>
  )
}
