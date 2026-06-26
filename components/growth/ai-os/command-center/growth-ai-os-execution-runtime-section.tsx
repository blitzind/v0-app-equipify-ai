"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { Cpu, Pause, Play, Square, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_STATES,
  type GrowthLeadResearchExecutionRuntimeReadModel,
  type GrowthLeadResearchExecutionRuntimeSummaryItem,
  type GrowthLeadResearchExecutionState,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"

function stateBadgeVariant(state: GrowthLeadResearchExecutionState) {
  if (state === "completed") return "secondary" as const
  if (state === "executing" || state === "ready") return "default" as const
  if (state === "paused" || state === "queued" || state === "validating") return "outline" as const
  return "destructive" as const
}

function ExecutionRow({
  item,
  runtimeEnabled,
  onAction,
  actionLoading,
}: {
  item: GrowthLeadResearchExecutionRuntimeSummaryItem
  runtimeEnabled: boolean
  onAction: (executionId: string, action: "pause" | "resume" | "cancel") => void
  actionLoading: string | null
}) {
  const loading = actionLoading === item.executionId
  return (
    <div className="rounded-lg border border-border/70 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{item.companyName ?? item.leadId}</p>
          <p className="text-xs text-muted-foreground">
            {item.workflowType.replaceAll("_", " ")} · {item.planId}
          </p>
        </div>
        <Badge variant={stateBadgeVariant(item.state)}>{item.state.replaceAll("_", " ")}</Badge>
      </div>
      <p className="mt-2 text-muted-foreground">
        Steps {item.stepsCompleted}/{item.stepsTotal}
        {item.blockReason ? ` · ${item.blockReason}` : null}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.observationHref ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={item.observationHref}>View lead</Link>
          </Button>
        ) : null}
        {runtimeEnabled && item.state === "executing" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => onAction(item.executionId, "pause")}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />}
            Pause
          </Button>
        ) : null}
        {runtimeEnabled && item.state === "paused" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => onAction(item.executionId, "resume")}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Resume
          </Button>
        ) : null}
        {runtimeEnabled && !["completed", "cancelled", "failed"].includes(item.state) ? (
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => onAction(item.executionId, "cancel")}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function ExecutionGroup({
  title,
  items,
  runtimeEnabled,
  onAction,
  actionLoading,
}: {
  title: string
  items: GrowthLeadResearchExecutionRuntimeSummaryItem[]
  runtimeEnabled: boolean
  onAction: (executionId: string, action: "pause" | "resume" | "cancel") => void
  actionLoading: string | null
}) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <ExecutionRow
            key={item.executionId}
            item={item}
            runtimeEnabled={runtimeEnabled}
            onAction={onAction}
            actionLoading={actionLoading}
          />
        ))}
      </div>
    </div>
  )
}

export function GrowthAiOsExecutionRuntimeSection({
  executionRuntime,
  onRefresh,
}: {
  executionRuntime: GrowthLeadResearchExecutionRuntimeReadModel
  onRefresh?: () => void
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const runAction = useCallback(
    async (executionId: string, action: "pause" | "resume" | "cancel") => {
      setActionLoading(executionId)
      try {
        const response = await fetch(`/api/platform/growth/ai-os/execution-runtime/${executionId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        })
        if (!response.ok) {
          const body = (await response.json()) as { message?: string; error?: string }
          throw new Error(body.message ?? body.error ?? "Action failed.")
        }
        onRefresh?.()
      } finally {
        setActionLoading(null)
      }
    },
    [onRefresh],
  )

  return (
    <Card
      data-qa-marker={GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER}
      data-qa-section="execution-runtime"
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Cpu className="size-5 text-violet-600" />
          Execution Runtime
        </CardTitle>
        <CardDescription>
          Internal-only workflow execution — no outbound, no providers, no Core mutations. Disabled by default.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
          <p className="font-medium">{executionRuntime.systemSummary.headline}</p>
          <p className="mt-1 text-muted-foreground">
            Runtime {executionRuntime.runtimeEnabled ? "enabled" : "disabled"} · Supported states:{" "}
            {GROWTH_LEAD_RESEARCH_EXECUTION_STATES.join(", ")}
          </p>
        </div>

        <ExecutionGroup
          title="Queued"
          items={executionRuntime.queuedExecutions}
          runtimeEnabled={executionRuntime.runtimeEnabled}
          onAction={runAction}
          actionLoading={actionLoading}
        />
        <ExecutionGroup
          title="Active"
          items={executionRuntime.activeExecutions}
          runtimeEnabled={executionRuntime.runtimeEnabled}
          onAction={runAction}
          actionLoading={actionLoading}
        />
        <ExecutionGroup
          title="Paused"
          items={executionRuntime.pausedExecutions}
          runtimeEnabled={executionRuntime.runtimeEnabled}
          onAction={runAction}
          actionLoading={actionLoading}
        />
        <ExecutionGroup
          title="Completed"
          items={executionRuntime.completedExecutions}
          runtimeEnabled={executionRuntime.runtimeEnabled}
          onAction={runAction}
          actionLoading={actionLoading}
        />
        <ExecutionGroup
          title="Failed"
          items={executionRuntime.failedExecutions}
          runtimeEnabled={executionRuntime.runtimeEnabled}
          onAction={runAction}
          actionLoading={actionLoading}
        />
        <ExecutionGroup
          title="Cancelled"
          items={executionRuntime.cancelledExecutions}
          runtimeEnabled={executionRuntime.runtimeEnabled}
          onAction={runAction}
          actionLoading={actionLoading}
        />

        {executionRuntime.queuedExecutions.length === 0 &&
        executionRuntime.activeExecutions.length === 0 &&
        executionRuntime.pausedExecutions.length === 0 &&
        executionRuntime.completedExecutions.length === 0 &&
        executionRuntime.failedExecutions.length === 0 &&
        executionRuntime.cancelledExecutions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No execution runtime records yet.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
