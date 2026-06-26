"use client"

import { ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { AiOsExecutMissionPlanningActiveWorkOrderSummary } from "@/lib/growth/aios/ai-executive-mission-planning-review-types"

export function GrowthAiOsActiveWorkOrdersCollapsible({
  workOrders,
}: {
  workOrders: AiOsExecutMissionPlanningActiveWorkOrderSummary[]
}) {
  return (
    <Collapsible defaultOpen={false} className="rounded-xl border border-border/70 bg-card shadow-sm">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/20">
        <div>
          <p className="text-sm font-semibold">Active Work Orders</p>
          <p className="text-xs text-muted-foreground">
            {workOrders.length} existing — duplicate detection context
          </p>
        </div>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-4 py-3">
        {workOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active Work Orders on this mission.</p>
        ) : (
          <div className="space-y-2">
            {workOrders.map((workOrder) => (
              <div
                key={workOrder.workOrderId}
                className="rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{workOrder.workOrderId.slice(0, 8)}…</span>
                  <Badge variant="outline">{workOrder.status}</Badge>
                  <span className="text-muted-foreground">{workOrder.workOrderType}</span>
                  <span className="text-muted-foreground">· {workOrder.assignedAgent}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
