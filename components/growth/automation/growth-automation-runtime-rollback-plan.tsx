"use client"

import type { GrowthAutomationRuntimeReconciliationRollbackPlanItem } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-types"

type Props = {
  items: GrowthAutomationRuntimeReconciliationRollbackPlanItem[]
}

export function GrowthAutomationRuntimeRollbackPlan({ items }: Props) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">Rollback plan unavailable until preview succeeds.</p>
  }

  return (
    <ol className="space-y-2 text-xs">
      {items.map((item) => (
        <li key={`${item.step}-${item.action}`} className="rounded-md border border-border/70 p-2">
          <p className="font-medium">
            Step {item.step}: {item.action}
          </p>
          <p className="text-muted-foreground">{item.detail}</p>
          {item.targetVersionId ? (
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.targetVersionId}</p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
