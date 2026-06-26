"use client"

import { CalendarClock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_SCHEDULER_READINESS_QA_MARKER,
  type GrowthSchedulerReadinessReadModel,
} from "@/lib/growth/aios/growth/growth-scheduler-readiness-types"

export function GrowthAiOsSchedulerReadinessSection({
  schedulerReadiness,
}: {
  schedulerReadiness: GrowthSchedulerReadinessReadModel
}) {
  const { readiness, priorityQueue, agentWakeRules } = schedulerReadiness

  return (
    <Card
      data-qa-marker={GROWTH_SCHEDULER_READINESS_QA_MARKER}
      data-qa-section="scheduler-readiness"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarClock className="size-5 text-violet-600" />
          Scheduler Readiness
        </CardTitle>
        <CardDescription>{schedulerReadiness.rule}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Mode · {readiness.schedulerMode.replaceAll("_", " ")}</Badge>
            <Badge variant="secondary">
              {readiness.activationStatus.replaceAll("_", " ")}
            </Badge>
            <Badge variant="outline">Scheduler inactive</Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Priority source: {readiness.prioritySource} · Queues:{" "}
            {readiness.eligibleMissionQueues.map((q) => q.replaceAll("_", " ")).join(", ") || "none"}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Priority queues</p>
            <p className="text-muted-foreground">
              Immediate {priorityQueue.immediateCount} · Today {priorityQueue.todayCount} · Week{" "}
              {priorityQueue.thisWeekCount}
            </p>
          </div>
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Budget limits</p>
            <p className="text-muted-foreground">
              Previews {readiness.budgetLimits.maxAgentPreviewsPerHour}/hr · Runtime{" "}
              {readiness.budgetLimits.maxInternalRuntimeCandidatesPerDay}/day · Spend $
              {readiness.budgetLimits.maxEstimatedSpendPerDay}/day
            </p>
          </div>
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Kill switches</p>
            <p className="text-muted-foreground">
              Emergency {readiness.killSwitchStatus.emergencyStop} · Autonomy{" "}
              {readiness.killSwitchStatus.autonomyDisabled}
            </p>
          </div>
        </div>

        {readiness.blockedReasons.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 text-sm text-amber-900">
            <p className="font-medium">Blocked reasons</p>
            <ul className="mt-1 list-inside list-disc text-xs">
              {readiness.blockedReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-2 text-sm">
          <p className="font-medium">Recommended activation path</p>
          <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
            {readiness.recommendedActivationPath.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Agent wake rules (preview only)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {agentWakeRules.map((rule) => (
              <div key={rule.agentKind} className="rounded-md border border-border/60 p-2 text-xs">
                <p className="font-medium">{rule.agentName}</p>
                <p className="text-muted-foreground">
                  Missions: {rule.requiredMissionTypes.map((t) => t.replaceAll("_", " ")).join(", ")}
                </p>
                <p className="text-muted-foreground">
                  Cooldown {rule.cooldownMinutes}m · max {rule.maxRunsPerPeriod}/{rule.periodHours}h
                </p>
              </div>
            ))}
          </div>
        </div>

        {priorityQueue.starvationWarnings.length > 0 ? (
          <p className="text-xs text-amber-800">
            Starvation warnings: {priorityQueue.starvationWarnings.length} — review before activation.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
