"use client"

import Link from "next/link"
import { Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { GrowthAutonomousQualificationPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import { GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_QA_MARKER } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import { GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function GrowthAiOsAutonomousQualificationPilotSection({
  autonomousQualificationPilot,
}: {
  autonomousQualificationPilot: GrowthAutonomousQualificationPilotReadModel
}) {
  const { telemetry } = autonomousQualificationPilot
  const configureHref = autonomousQualificationPilot.configureHref ?? GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH

  return (
    <Card
      data-qa-marker={GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_QA_MARKER}
      data-qa-section="autonomous-qualification-pilot"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="size-5 text-emerald-600" />
          Autonomous Qualification Agent
        </CardTitle>
        <CardDescription>
          Read-only diagnostics — control qualification autonomy in Growth Autonomy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={autonomousQualificationPilot.enabled ? "secondary" : "outline"}>
            {autonomousQualificationPilot.controlState.replaceAll("_", " ")}
          </Badge>
          <Badge variant="outline">
            {autonomousQualificationPilot.schedulerMode.replaceAll("_", " ")}
          </Badge>
          {autonomousQualificationPilot.policyDerived ? (
            <Badge variant="outline">Policy-derived</Badge>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Eligible</p>
            <p className="text-muted-foreground">{telemetry.eligibleLeads}</p>
          </div>
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Completed</p>
            <p className="text-muted-foreground">{telemetry.successfulRuns}</p>
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
              {telemetry.budgetConsumptionHour}/{autonomousQualificationPilot.budgetLimits.maxRunsPerHour} hr ·{" "}
              {telemetry.budgetConsumptionDay}/{autonomousQualificationPilot.budgetLimits.maxRunsPerDay} day
            </p>
          </div>
        </div>

        {autonomousQualificationPilot.latestDecisions.length > 0 ? (
          <div className="space-y-2 text-xs">
            <p className="font-medium text-sm">Latest qualification decisions</p>
            {autonomousQualificationPilot.latestDecisions.slice(0, 3).map((decision) => (
              <div key={`${decision.leadId}-${decision.qualifiedAt}`} className="rounded-md border border-border/60 p-2">
                <p className="font-medium">
                  {decision.companyName ?? decision.leadId} · {decision.qualificationStatus}
                </p>
                <p className="text-muted-foreground">
                  Fit {decision.icpFitScore} · signals {decision.buyingSignalScore} · confidence{" "}
                  {Math.round(decision.confidence * 100)}%
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {autonomousQualificationPilot.revenueOperatorSupervision.approveWakeRecommendation}
        </p>

        <Link href={configureHref} className="inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700">
          Configure in Growth Autonomy
        </Link>
      </CardContent>
    </Card>
  )
}
