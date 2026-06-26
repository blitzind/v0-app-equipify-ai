"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import { GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_QA_MARKER } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import { cn } from "@/lib/utils"

function readinessBadgeVariant(readiness: GrowthLeadResearchExecutionPlan["executionReadiness"]) {
  if (readiness === "ready") return "secondary" as const
  if (readiness === "needs_approval") return "default" as const
  if (readiness === "blocked") return "destructive" as const
  return "outline" as const
}

export function GrowthAiOsLeadResearchExecutionPlanSection({
  plan,
  title = "Execution Plan",
  description = "Planning-only workflow map — no Work Orders are created from this surface.",
  compact = false,
}: {
  plan: GrowthLeadResearchExecutionPlan
  title?: string
  description?: string
  compact?: boolean
}) {
  return (
    <Card data-qa-marker={GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_QA_MARKER} data-qa-section="execution-plan">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={cn("space-y-4 text-sm", compact && "space-y-3")}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{plan.workflowType.replaceAll("_", " ")}</Badge>
          <Badge variant={readinessBadgeVariant(plan.executionReadiness)}>
            {plan.executionReadiness.replaceAll("_", " ")}
          </Badge>
          {plan.approvalRequired ? <Badge variant="secondary">Approval required</Badge> : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Next best action:</span> {plan.nextBestAction}
          </p>
          <p>
            <span className="text-muted-foreground">Duration:</span> {plan.estimatedDuration}
          </p>
          <p>
            <span className="text-muted-foreground">Effort / cost:</span> {plan.estimatedCost}
          </p>
          <p>
            <span className="text-muted-foreground">Expected outcome:</span> {plan.expectedOutcome}
          </p>
        </div>

        {!compact ? (
          <>
            <div>
              <p className="font-medium">Estimated steps</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {plan.estimatedSteps.map((step) => (
                  <li key={step.stepId}>
                    {step.label}
                    {step.workOrderType ? ` · ${step.workOrderType.replaceAll("_", " ")}` : null}
                  </li>
                ))}
              </ul>
            </div>

            {plan.requiredWorkOrders.length > 0 ? (
              <div>
                <p className="font-medium">Required Work Orders (future)</p>
                <p className="mt-1 text-muted-foreground">
                  {plan.requiredWorkOrders.map((type) => type.replaceAll("_", " ")).join(" · ")}
                </p>
              </div>
            ) : null}

            {plan.prerequisites.length > 0 ? (
              <div>
                <p className="font-medium">Prerequisites</p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {plan.prerequisites.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {plan.missingPrerequisites.length > 0 ? (
              <div>
                <p className="font-medium text-amber-700">Missing prerequisites</p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {plan.missingPrerequisites.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="font-medium">Success criteria</p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {plan.successCriteria.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium">Failure conditions</p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {plan.failureConditions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Rollback:</span> {plan.rollbackStrategy}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
