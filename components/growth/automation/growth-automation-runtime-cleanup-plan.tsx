"use client"

import type { GrowthAutomationRuntimeReconciliationCleanupPlanItem } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-types"

type Props = {
  items: GrowthAutomationRuntimeReconciliationCleanupPlanItem[]
}

export function GrowthAutomationRuntimeCleanupPlan({ items }: Props) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">No cleanup actions required for this preview.</p>
  }

  return (
    <ul className="space-y-2 text-xs">
      {items.map((item) => (
        <li key={item.previewId} className="rounded-md border border-border/70 p-2">
          <p className="font-medium">{item.artifactKind}</p>
          <p className="text-muted-foreground">{item.reason}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{item.action}</p>
        </li>
      ))}
    </ul>
  )
}
