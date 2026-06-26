"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { FlaskConical } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_STATUSES,
  type GrowthLeadResearchExecutionSimulationReadModel,
  type GrowthLeadResearchExecutionSimulationStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-simulation-types"

function simulationBadgeVariant(status: GrowthLeadResearchExecutionSimulationStatus) {
  if (status === "simulation_success") return "secondary" as const
  if (status === "simulation_ready" || status === "simulation_partial_success") return "default" as const
  if (status === "simulation_not_allowed") return "outline" as const
  return "destructive" as const
}

const STATUS_FILTERS = ["all", ...GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_STATUSES] as const

export function GrowthAiOsExecutionSimulationSection({
  simulation,
}: {
  simulation: GrowthLeadResearchExecutionSimulationReadModel
}) {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all")
  const [planOnly, setPlanOnly] = useState(true)

  const filteredPlans = useMemo(() => {
    return simulation.planSimulations.filter((row) => {
      if (statusFilter !== "all" && row.simulatedExecutionStatus !== statusFilter) return false
      return true
    })
  }, [simulation.planSimulations, statusFilter])

  const filteredWorkflows = useMemo(() => {
    if (planOnly) return []
    return simulation.workflowSimulations.filter((row) => {
      if (statusFilter !== "all" && row.simulatedExecutionStatus !== statusFilter) return false
      return true
    })
  }, [planOnly, simulation.workflowSimulations, statusFilter])

  return (
    <Card
      data-qa-marker={GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_QA_MARKER}
      data-qa-section="execution-simulation"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FlaskConical className="size-5 text-violet-600" />
          Execution Simulation
        </CardTitle>
        <CardDescription>
          In-memory execution prediction — simulates approved plans without Work Orders, providers, or outbound.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <p className="font-medium">{simulation.systemSummary.headline}</p>
          <p className="mt-1 text-muted-foreground">
            Success: {simulation.systemSummary.successCount} · Partial: {simulation.systemSummary.partialSuccessCount}{" "}
            · Ready: {simulation.systemSummary.readyCount} · Blocked:{" "}
            {simulation.systemSummary.blockedCount + simulation.systemSummary.failedPreflightCount}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={planOnly ? "default" : "outline"} onClick={() => setPlanOnly(true)}>
            Approved plans
          </Button>
          <Button size="sm" variant={!planOnly ? "default" : "outline"} onClick={() => setPlanOnly(false)}>
            All workflows
          </Button>
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={statusFilter === filter ? "default" : "outline"}
              onClick={() => setStatusFilter(filter)}
            >
              {filter.replaceAll("_", " ")}
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          {(planOnly ? filteredPlans : [...filteredPlans, ...filteredWorkflows]).map((report) => (
            <div key={report.simulationId} className="rounded-lg border border-border/70 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">
                  {report.companyName ?? report.workflowType.replaceAll("_", " ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{report.boundaryClassification.replaceAll("_", " ")}</Badge>
                  <Badge variant={simulationBadgeVariant(report.simulatedExecutionStatus)}>
                    {report.simulatedExecutionStatus.replaceAll("_", " ")}
                  </Badge>
                  <Badge variant="outline">{Math.round(report.confidence * 100)}% confidence</Badge>
                </div>
              </div>
              <p className="mt-2 text-muted-foreground">{report.simulationSummary}</p>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="font-medium text-foreground">Predicted timeline</p>
                  <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                    {report.predictedTimeline.slice(0, 4).map((step) => (
                      <li key={step.stepId}>
                        +{step.offsetMinutes}m · {step.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-foreground">Predicted actions</p>
                  <p className="mt-1 text-muted-foreground">
                    Work Orders:{" "}
                    {report.predictedWorkOrders.length > 0
                      ? report.predictedWorkOrders.map((t) => t.replaceAll("_", " ")).join(", ")
                      : "none"}
                  </p>
                  <p className="text-muted-foreground">
                    Outbound: {report.predictedOutboundActions.join(" · ") || "none"}
                  </p>
                </div>
              </div>

              {report.predictedApprovals.length > 0 ? (
                <p className="mt-2 text-muted-foreground">
                  <span className="font-medium text-foreground">Approvals:</span>{" "}
                  {report.predictedApprovals.slice(0, 3).join(" · ")}
                </p>
              ) : null}

              {report.predictedFailurePoints.length > 0 ? (
                <ul className="mt-2 list-disc pl-4 text-amber-700">
                  {report.predictedFailurePoints.slice(0, 3).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}

              <p className="mt-2 text-xs text-muted-foreground">
                Providers (simulated): {report.predictedProviderUsage.slice(0, 3).join(", ") || "none"} · Rollback:{" "}
                {report.predictedRollbackPath.slice(0, 80)}
                {report.predictedRollbackPath.length > 80 ? "…" : ""}
              </p>

              {report.observationHref ? (
                <Link href={report.observationHref} className="mt-2 inline-flex text-indigo-600 hover:text-indigo-700">
                  Open observation
                </Link>
              ) : null}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Simulation generated {new Date(simulation.generatedAt).toLocaleString()} · in-memory only
        </p>
      </CardContent>
    </Card>
  )
}
