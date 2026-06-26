"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { ClipboardCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_APPROVAL_STATUSES,
  GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_QA_MARKER,
  type GrowthLeadResearchExecutionPlanApprovalStatus,
  type GrowthLeadResearchExecutionPlanQueueItem,
  type GrowthLeadResearchExecutionPlanReviewAction,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { cn } from "@/lib/utils"

function approvalBadgeVariant(status: GrowthLeadResearchExecutionPlanApprovalStatus) {
  if (status === "approved_for_future_execution") return "secondary" as const
  if (status === "pending_review") return "default" as const
  if (status === "needs_changes") return "outline" as const
  if (status === "blocked") return "destructive" as const
  return "outline" as const
}

function readinessBadgeVariant(readiness: GrowthLeadResearchExecutionPlanQueueItem["readinessStatus"]) {
  if (readiness === "ready") return "secondary" as const
  if (readiness === "needs_approval") return "default" as const
  if (readiness === "blocked") return "destructive" as const
  return "outline" as const
}

const READINESS_FILTERS = ["all", "ready", "needs_approval", "blocked", "not_applicable"] as const
const APPROVAL_FILTERS = ["all", ...GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_APPROVAL_STATUSES] as const

export function GrowthAiOsExecutionPlanReviewSection({
  queue,
  onQueueUpdated,
}: {
  queue: GrowthLeadResearchExecutionPlanQueueItem[]
  onQueueUpdated?: () => void | Promise<void>
}) {
  const [readinessFilter, setReadinessFilter] = useState<(typeof READINESS_FILTERS)[number]>("all")
  const [approvalFilter, setApprovalFilter] = useState<(typeof APPROVAL_FILTERS)[number]>("all")
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      if (readinessFilter !== "all" && item.readinessStatus !== readinessFilter) return false
      if (approvalFilter !== "all" && item.approvalStatus !== approvalFilter) return false
      return true
    })
  }, [approvalFilter, queue, readinessFilter])

  const submitReviewAction = useCallback(
    async (item: GrowthLeadResearchExecutionPlanQueueItem, action: GrowthLeadResearchExecutionPlanReviewAction) => {
      setBusyLeadId(item.leadId)
      setActionError(null)
      try {
        const response = await fetch(`/api/platform/growth/ai-os/execution-plan-review/${item.leadId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: item.planId, action }),
        })
        const body = (await response.json()) as { ok?: boolean; message?: string; error?: string }
        if (!response.ok || !body.ok) {
          throw new Error(body.message ?? body.error ?? "Could not record review action.")
        }
        await onQueueUpdated?.()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Could not record review action.")
      } finally {
        setBusyLeadId(null)
      }
    },
    [onQueueUpdated],
  )

  return (
    <Card data-qa-marker={GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_QA_MARKER} data-qa-section="execution-plan-review">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardCheck className="size-5 text-emerald-600" />
          Execution Plan Review
        </CardTitle>
        <CardDescription>
          Operator approval queue for assessed lead execution plans — planning state only, no Work Order execution.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-muted-foreground self-center">Readiness</span>
          {READINESS_FILTERS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={readinessFilter === filter ? "default" : "outline"}
              onClick={() => setReadinessFilter(filter)}
            >
              {filter.replaceAll("_", " ")}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-muted-foreground self-center">Approval</span>
          {APPROVAL_FILTERS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={approvalFilter === filter ? "default" : "outline"}
              onClick={() => setApprovalFilter(filter)}
            >
              {filter.replaceAll("_", " ")}
            </Button>
          ))}
        </div>

        {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

        {filteredQueue.length === 0 ? (
          <p className="text-sm text-muted-foreground">No execution plans match the current filters.</p>
        ) : (
          <div className="space-y-3">
            {filteredQueue.map((item) => (
              <div key={item.planId} className="rounded-lg border border-border/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.companyName ?? item.leadId.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{item.planId}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{item.recommendedWorkflow.replaceAll("_", " ")}</Badge>
                    <Badge variant={readinessBadgeVariant(item.readinessStatus)}>
                      {item.readinessStatus.replaceAll("_", " ")}
                    </Badge>
                    <Badge variant={approvalBadgeVariant(item.approvalStatus)}>
                      {item.approvalStatus.replaceAll("_", " ")}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Duration:</span> {item.estimatedDuration}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Cost:</span> {item.estimatedCost}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Confidence:</span>{" "}
                    {item.confidence != null ? `${Math.round(item.confidence * 100)}%` : "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Approval required:</span>{" "}
                    {item.approvalRequired ? "Yes" : "No"}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">Reason:</span> {item.reason}
                  </p>
                  {item.missingPrerequisites.length > 0 ? (
                    <p className="sm:col-span-2 text-amber-700">
                      Missing prerequisites: {item.missingPrerequisites.join(" · ")}
                    </p>
                  ) : null}
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    Created {new Date(item.createdAt).toLocaleString()}
                    {item.reviewUpdatedAt
                      ? ` · Reviewed ${new Date(item.reviewUpdatedAt).toLocaleString()}`
                      : null}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["approve_for_future_execution", "Approve for future execution"],
                      ["mark_needs_changes", "Needs changes"],
                      ["block_plan", "Block plan"],
                      ["dismiss_plan", "Dismiss plan"],
                    ] as const
                  ).map(([action, label]) => (
                    <Button
                      key={action}
                      size="sm"
                      variant="outline"
                      disabled={busyLeadId === item.leadId}
                      onClick={() => void submitReviewAction(item, action)}
                    >
                      {label}
                    </Button>
                  ))}
                  <Link
                    href={item.observationHref}
                    className={cn(
                      "inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700",
                      busyLeadId === item.leadId && "pointer-events-none opacity-50",
                    )}
                  >
                    Open observation
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
