"use client"

import Link from "next/link"
import { Bot } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { GrowthAutonomousResearchPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-types"
import { GROWTH_AUTONOMOUS_RESEARCH_PILOT_QA_MARKER } from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-types"
import { GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function GrowthAiOsAutonomousResearchPilotSection({
  autonomousResearchPilot,
}: {
  autonomousResearchPilot: GrowthAutonomousResearchPilotReadModel
  onRefresh?: () => void
}) {
  const { telemetry } = autonomousResearchPilot
  const configureHref = autonomousResearchPilot.configureHref ?? GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH

  return (
    <Card
      data-qa-marker={GROWTH_AUTONOMOUS_RESEARCH_PILOT_QA_MARKER}
      data-qa-section="autonomous-research-pilot"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="size-5 text-sky-600" />
          Autonomous Research Agent
        </CardTitle>
        <CardDescription>
          Read-only diagnostics — control research autonomy in Growth Autonomy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={autonomousResearchPilot.enabled ? "secondary" : "outline"}>
            {autonomousResearchPilot.controlState.replaceAll("_", " ")}
          </Badge>
          <Badge variant="outline">
            {autonomousResearchPilot.schedulerMode.replaceAll("_", " ")}
          </Badge>
          {autonomousResearchPilot.policyDerived ? (
            <Badge variant="outline">Policy-derived</Badge>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Completed</p>
            <p className="text-muted-foreground">{telemetry.successfulRuns}</p>
          </div>
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Skipped</p>
            <p className="text-muted-foreground">{telemetry.skippedRuns}</p>
          </div>
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Failures</p>
            <p className="text-muted-foreground">{telemetry.failedRuns}</p>
          </div>
          <div className="rounded-md border border-border/60 p-2">
            <p className="font-medium">Budget</p>
            <p className="text-muted-foreground">
              {telemetry.budgetConsumptionHour}/{autonomousResearchPilot.budgetLimits.maxRunsPerHour} hr ·{" "}
              {telemetry.budgetConsumptionDay}/{autonomousResearchPilot.budgetLimits.maxRunsPerDay} day
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Avg duration {telemetry.averageDurationMs}ms · confidence {telemetry.averageConfidence} · stale
          resolved {telemetry.staleResearchResolved}
        </p>

        <p className="text-sm text-muted-foreground">
          {autonomousResearchPilot.revenueOperatorSupervision.approveWakeRecommendation}
        </p>

        <Link href={configureHref} className="inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700">
          Configure in Growth Autonomy
        </Link>
      </CardContent>
    </Card>
  )
}
