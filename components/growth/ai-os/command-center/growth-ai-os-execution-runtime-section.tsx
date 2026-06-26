"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { Cpu, FlaskConical, Pause, Play, Square, Loader2, Rocket } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_STATUSES,
  summarizeDryRunReport,
  type GrowthLeadResearchExecutionDryRunReport,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-types"
import {
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
  GROWTH_LEAD_RESEARCH_EXECUTION_STATES,
  type GrowthLeadResearchExecutionRuntimeReadModel,
  type GrowthLeadResearchExecutionRuntimeSummaryItem,
  type GrowthLeadResearchExecutionState,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import {
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_QA_MARKER,
  type GrowthLeadResearchExecutionRuntimePilotPlanItem,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-types"

function stateBadgeVariant(state: GrowthLeadResearchExecutionState) {
  if (state === "completed") return "secondary" as const
  if (state === "executing" || state === "ready") return "default" as const
  if (state === "paused" || state === "queued" || state === "validating") return "outline" as const
  return "destructive" as const
}

function dryRunStatusBadgeVariant(status: GrowthLeadResearchExecutionDryRunReport["finalStatus"]) {
  if (status === "dry_run_passed") return "secondary" as const
  if (status === "dry_run_not_allowed") return "outline" as const
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
  const [dryRunLoadingPlanId, setDryRunLoadingPlanId] = useState<string | null>(null)
  const [enqueueLoadingPlanId, setEnqueueLoadingPlanId] = useState<string | null>(null)
  const [latestDryRunReport, setLatestDryRunReport] = useState<GrowthLeadResearchExecutionDryRunReport | null>(null)
  const [dryRunError, setDryRunError] = useState<string | null>(null)
  const [enqueueError, setEnqueueError] = useState<string | null>(null)

  const effectiveRuntimeEnabled = executionRuntime.pilotSummary.effectiveRuntimeEnabled

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

  const runDryRun = useCallback(async (plan: (typeof executionRuntime.dryRunEligiblePlans)[number]) => {
    setDryRunLoadingPlanId(plan.planId)
    setDryRunError(null)
    try {
      const response = await fetch("/api/platform/growth/ai-os/execution-runtime/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.planId,
          leadId: plan.leadId,
          executionPlan: plan.executionPlan,
          approvalState: plan.approvalState,
          confidence: plan.confidence,
        }),
      })
      const body = (await response.json()) as {
        ok?: boolean
        report?: GrowthLeadResearchExecutionDryRunReport
        message?: string
        error?: string
      }
      if (!response.ok || !body.ok || !body.report) {
        throw new Error(body.message ?? body.error ?? "Dry-run failed.")
      }
      setLatestDryRunReport(body.report)
    } catch (error) {
      setDryRunError(error instanceof Error ? error.message : "Dry-run failed.")
    } finally {
      setDryRunLoadingPlanId(null)
    }
  }, [])

  const runEnqueue = useCallback(
    async (plan: GrowthLeadResearchExecutionRuntimePilotPlanItem) => {
      setEnqueueLoadingPlanId(plan.planId)
      setEnqueueError(null)
      try {
        const response = await fetch("/api/platform/growth/ai-os/execution-runtime/enqueue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: plan.planId,
            leadId: plan.leadId,
            companyName: plan.companyName,
            executionPlan: plan.executionPlan,
            approvalState: plan.approvalState,
            confidence: plan.confidence,
            runtimeEnabled: executionRuntime.pilotSummary.runtimeEnabled,
            pilotEnabled: executionRuntime.pilotSummary.pilotEnabled,
          }),
        })
        const body = (await response.json()) as { ok?: boolean; message?: string; error?: string }
        if (!response.ok || !body.ok) {
          throw new Error(body.message ?? body.error ?? "Enqueue failed.")
        }
        onRefresh?.()
      } catch (error) {
        setEnqueueError(error instanceof Error ? error.message : "Enqueue failed.")
      } finally {
        setEnqueueLoadingPlanId(null)
      }
    },
    [executionRuntime.pilotSummary.pilotEnabled, executionRuntime.pilotSummary.runtimeEnabled, onRefresh],
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

        <div
          className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 p-3 text-sm"
          data-qa-marker={GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_PILOT_QA_MARKER}
          data-qa-section="execution-runtime-pilot"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Rocket className="size-4 text-emerald-700" />
            <p className="font-medium">Runtime Pilot — research_company only</p>
            <Badge variant={executionRuntime.pilotSummary.pilotEnabled ? "secondary" : "outline"}>
              Pilot {executionRuntime.pilotSummary.pilotEnabled ? "enabled" : "disabled"}
            </Badge>
            <Badge variant={effectiveRuntimeEnabled ? "secondary" : "outline"}>
              Effective runtime {effectiveRuntimeEnabled ? "on" : "off"}
            </Badge>
          </div>
          <p className="mt-2 text-muted-foreground">{executionRuntime.pilotSummary.headline}</p>
          <p className="mt-1 text-xs text-muted-foreground">{executionRuntime.pilotRule}</p>

          {executionRuntime.pilotEligiblePlans.length === 0 ? (
            <p className="mt-3 text-muted-foreground">No research_company plans eligible for enqueue.</p>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Eligible plans</p>
              {executionRuntime.pilotEligiblePlans.map((plan) => {
                const loading = enqueueLoadingPlanId === plan.planId
                return (
                  <div key={plan.planId} className="rounded-md border border-border/60 bg-background/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{plan.companyName ?? plan.leadId}</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.workflowType.replaceAll("_", " ")} · {plan.planId}
                        </p>
                        {plan.latestDryRunStatus ? (
                          <p className="text-xs text-muted-foreground">
                            Dry-run · {plan.latestDryRunStatus.replaceAll("_", " ")}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading || !effectiveRuntimeEnabled}
                        onClick={() => void runEnqueue(plan)}
                      >
                        {loading ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                        Enqueue
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {executionRuntime.pilotBlockedPlans.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blocked plans</p>
              {executionRuntime.pilotBlockedPlans.slice(0, 8).map((plan) => (
                <div key={plan.planId} className="rounded-md border border-border/60 bg-background/60 p-3">
                  <p className="font-medium">{plan.companyName ?? plan.leadId}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.workflowType.replaceAll("_", " ")} · {plan.blockReason ?? "Blocked"}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {enqueueError ? <p className="mt-2 text-sm text-destructive">{enqueueError}</p> : null}
        </div>

        <div
          className="rounded-lg border border-dashed border-violet-200 bg-violet-50/40 p-3 text-sm"
          data-qa-marker={GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_QA_MARKER}
          data-qa-section="execution-dry-run"
        >
          <div className="flex flex-wrap items-center gap-2">
            <FlaskConical className="size-4 text-violet-600" />
            <p className="font-medium">Internal Workflow Dry-Run (non-persistent)</p>
            <Badge variant="outline">Session only</Badge>
          </div>
          <p className="mt-2 text-muted-foreground">{executionRuntime.dryRunRule}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Statuses: {GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_STATUSES.join(", ")}
          </p>

          {executionRuntime.dryRunEligiblePlans.length === 0 ? (
            <p className="mt-3 text-muted-foreground">No approved internal workflows eligible for dry-run.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {executionRuntime.dryRunEligiblePlans.map((plan) => {
                const loading = dryRunLoadingPlanId === plan.planId
                return (
                  <div key={plan.planId} className="rounded-md border border-border/60 bg-background/80 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{plan.companyName ?? plan.leadId}</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.workflowType.replaceAll("_", " ")} · {plan.planId}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => void runDryRun(plan)}
                      >
                        {loading ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
                        Dry-run
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {dryRunError ? <p className="mt-2 text-sm text-destructive">{dryRunError}</p> : null}

          {latestDryRunReport ? (
            <div className="mt-3 rounded-md border border-border/70 bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={dryRunStatusBadgeVariant(latestDryRunReport.finalStatus)}>
                  {latestDryRunReport.finalStatus.replaceAll("_", " ")}
                </Badge>
                <Badge variant="outline">Non-persistent</Badge>
              </div>
              <p className="mt-2 text-muted-foreground">{summarizeDryRunReport(latestDryRunReport)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Dry run id: {latestDryRunReport.dryRunId} · Steps simulated:{" "}
                {latestDryRunReport.simulatedSteps.filter((step) => step.status === "completed").length}/
                {latestDryRunReport.simulatedSteps.length} · Provider/outbound/Core/Work Orders:{" "}
                {latestDryRunReport.sideEffectCounters.providerCalls}/
                {latestDryRunReport.sideEffectCounters.outboundActions}/
                {latestDryRunReport.sideEffectCounters.coreMutations}/
                {latestDryRunReport.sideEffectCounters.workOrdersCreated}
              </p>
              {latestDryRunReport.blockedReasons.length > 0 ? (
                <p className="mt-2 text-sm text-amber-700">
                  Blocked: {latestDryRunReport.blockedReasons.join(" · ")}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <ExecutionGroup
          title="Queued"
          items={executionRuntime.queuedExecutions}
          runtimeEnabled={effectiveRuntimeEnabled}
          onAction={runAction}
          actionLoading={actionLoading}
        />
        <ExecutionGroup
          title="Active"
          items={executionRuntime.activeExecutions}
          runtimeEnabled={effectiveRuntimeEnabled}
          onAction={runAction}
          actionLoading={actionLoading}
        />
        <ExecutionGroup
          title="Paused"
          items={executionRuntime.pausedExecutions}
          runtimeEnabled={effectiveRuntimeEnabled}
          onAction={runAction}
          actionLoading={actionLoading}
        />
        <ExecutionGroup
          title="Completed"
          items={executionRuntime.completedExecutions}
          runtimeEnabled={effectiveRuntimeEnabled}
          onAction={runAction}
          actionLoading={actionLoading}
        />
        <ExecutionGroup
          title="Failed"
          items={executionRuntime.failedExecutions}
          runtimeEnabled={effectiveRuntimeEnabled}
          onAction={runAction}
          actionLoading={actionLoading}
        />
        <ExecutionGroup
          title="Cancelled"
          items={executionRuntime.cancelledExecutions}
          runtimeEnabled={effectiveRuntimeEnabled}
          onAction={runAction}
          actionLoading={actionLoading}
        />

        {executionRuntime.executionAuditSummaries.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Lifecycle event history
            </p>
            {executionRuntime.executionAuditSummaries.map((summary) => (
              <div key={summary.executionId} className="rounded-lg border border-border/70 p-3 text-sm">
                <p className="font-medium">{summary.executionId}</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {summary.entries.slice(-6).map((entry) => (
                    <li key={entry.auditId}>
                      {entry.eventType.replaceAll("_", " ")} · {entry.nextState ?? entry.previousState ?? "—"}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

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
