"use client"

import type { GrowthAutomationRuntimeExecutionRun } from "@/lib/growth/automation/growth-automation-runtime-execution-types"
import { GrowthAutomationRuntimeExecutionStatusBadge } from "@/components/growth/automation/growth-automation-runtime-execution-status-badge"

type Props = {
  execution: GrowthAutomationRuntimeExecutionRun | null
}

export function GrowthAutomationRuntimeStepTimeline({ execution }: Props) {
  if (!execution) {
    return <p className="text-sm text-muted-foreground">No runtime execution timeline yet.</p>
  }

  if (execution.stepResults.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        <GrowthAutomationRuntimeExecutionStatusBadge status={execution.status} />
        <p className="mt-2">Enrollment ready — use manual advance to progress steps.</p>
      </div>
    )
  }

  return (
    <ol className="space-y-2">
      {execution.stepResults.map((step) => (
        <li key={`${step.enrollmentStepId}-${step.stepOrder}`} className="rounded-md border border-border/70 p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              Step {step.stepOrder} · {step.stepKind}
            </span>
            <GrowthAutomationRuntimeExecutionStatusBadge status={step.status} />
          </div>
          <p className="mt-1 text-muted-foreground">{step.detail}</p>
        </li>
      ))}
    </ol>
  )
}
