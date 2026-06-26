"use client"

import Link from "next/link"
import { Map } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { GrowthAutonomousPlanningPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-types"
import { GROWTH_AUTONOMOUS_PLANNING_PILOT_QA_MARKER } from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-types"
import { GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function GrowthAiOsAutonomousPlanningPilotSection({
  autonomousPlanningPilot,
}: {
  autonomousPlanningPilot: GrowthAutonomousPlanningPilotReadModel
}) {
  const { telemetry } = autonomousPlanningPilot
  const configureHref = autonomousPlanningPilot.configureHref ?? GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH

  return (
    <Card
      data-qa-marker={GROWTH_AUTONOMOUS_PLANNING_PILOT_QA_MARKER}
      data-qa-section="autonomous-planning-pilot"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Map className="size-5 text-sky-600" />
          Autonomous Planning Agent
        </CardTitle>
        <CardDescription>
          Read-only diagnostics — control planning autonomy in Growth Autonomy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={autonomousPlanningPilot.enabled ? "secondary" : "outline"}>
            {autonomousPlanningPilot.controlState.replaceAll("_", " ")}
          </Badge>
          <Badge variant="outline">
            {autonomousPlanningPilot.schedulerMode.replaceAll("_", " ")}
          </Badge>
          {autonomousPlanningPilot.policyDerived ? (
            <Badge variant="outline">Policy-derived</Badge>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6 text-xs">
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Eligible</p>
            <p className="text-muted-foreground">{telemetry.eligibleLeads}</p>
          </div>
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Plans generated</p>
            <p className="text-muted-foreground">{telemetry.plansGenerated}</p>
          </div>
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Blocked</p>
            <p className="text-muted-foreground">{telemetry.blockedPlanning}</p>
          </div>
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Skipped</p>
            <p className="text-muted-foreground">{telemetry.skippedRuns}</p>
          </div>
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Failed</p>
            <p className="text-muted-foreground">{telemetry.failedRuns}</p>
          </div>
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Budget</p>
            <p className="text-muted-foreground">
              {telemetry.budgetConsumptionHour}/{autonomousPlanningPilot.budgetLimits.maxRunsPerHour} hr ·{" "}
              {telemetry.budgetConsumptionDay}/{autonomousPlanningPilot.budgetLimits.maxRunsPerDay} day
            </p>
          </div>
        </div>

        {autonomousPlanningPilot.latestPlans.length > 0 ? (
          <div className="space-y-2 text-xs">
            <p className="font-medium text-sm">Latest execution plans</p>
            {autonomousPlanningPilot.latestPlans.slice(0, 3).map((plan) => (
              <div key={`${plan.leadId}-${plan.plannedAt}`} className="rounded-md border border-border/60 p-2">
                <p className="font-medium">
                  {plan.companyName ?? plan.leadId} · {plan.workflowType.replaceAll("_", " ")}
                </p>
                <p className="text-muted-foreground">
                  {plan.executionReadiness.replaceAll("_", " ")} · confidence {Math.round(plan.confidence * 100)}%
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {autonomousPlanningPilot.revenueOperatorSupervision.approveWakeRecommendation}
        </p>

        <Link href={configureHref} className="inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700">
          Configure in Growth Autonomy
        </Link>
      </CardContent>
    </Card>
  )
}
