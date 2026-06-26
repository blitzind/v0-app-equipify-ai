"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ClipboardCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  GROWTH_AI_OS_SAFE_INDEX_HREF,
  aiOsMissionIdValidationMessage,
  resolveAiOsMissionIdParam,
  type AiOsMissionIdValidationFailureReason,
} from "@/lib/growth/aios/ai-os-mission-route-params"
import type {
  AiExecutiveMissionPlanningActiveWorkOrderSummary,
  AiExecutiveMissionPlanningReviewApproveResult,
  AiExecutiveMissionPlanningReviewPreviewResult,
  AiExecutiveMissionPlanningReviewReadModel,
} from "@/lib/growth/aios/ai-executive-mission-planning-review-types"
import { GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER } from "@/lib/growth/aios/ai-executive-mission-planning-review-types"
import type { AiExecutiveWorkOrderProposal } from "@/lib/growth/aios/ai-executive-mission-planning-types"

type ApiReadResponse = {
  ok?: boolean
  review?: AiExecutiveMissionPlanningReviewReadModel
  message?: string
  error?: string
}

type ApiPreviewResponse = {
  ok?: boolean
  preview?: AiExecutiveMissionPlanningReviewPreviewResult
  message?: string
  error?: string
}

type ApiApproveResponse = {
  ok?: boolean
  approval?: AiExecutiveMissionPlanningReviewApproveResult
  message?: string
  error?: string
}

export function GrowthAiOsMissionPlanningInvalidMissionEmptyState({
  reason,
  missionId,
}: {
  reason: AiOsMissionIdValidationFailureReason
  missionId?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mission not available</CardTitle>
        <CardDescription>{aiOsMissionIdValidationMessage(reason)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {missionId?.trim() ? (
          <p>
            <span className="text-muted-foreground">Requested mission id:</span>{" "}
            <span className="font-mono text-xs">{missionId}</span>
          </p>
        ) : null}
        <p className="text-muted-foreground">
          Open Mission Planning Review from a Growth objective or Lead Research Pilot observation with a real mission
          id.
        </p>
        <Button type="button" variant="outline" asChild>
          <Link href={GROWTH_AI_OS_SAFE_INDEX_HREF}>Back to objectives</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function WorkOrderProposalTable({
  proposals,
  emptyLabel,
}: {
  proposals: AiExecutiveWorkOrderProposal[]
  emptyLabel: string
}) {
  if (proposals.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Agent</th>
            <th className="px-3 py-2 font-medium">Entity</th>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">Rationale</th>
          </tr>
        </thead>
        <tbody>
          {proposals.map((proposal) => (
            <tr key={proposal.proposalKey} className="border-t">
              <td className="px-3 py-2 font-mono text-xs">{proposal.workOrderType}</td>
              <td className="px-3 py-2">{proposal.assignedAgent}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {proposal.entityType ?? "—"}:{proposal.entityId ?? "—"}
              </td>
              <td className="px-3 py-2">{proposal.priority}</td>
              <td className="px-3 py-2 text-muted-foreground">{proposal.rationale}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActiveWorkOrdersTable({ workOrders }: { workOrders: AiExecutiveMissionPlanningActiveWorkOrderSummary[] }) {
  if (workOrders.length === 0) {
    return <p className="text-sm text-muted-foreground">No active Work Orders on this mission.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">ID</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Agent</th>
          </tr>
        </thead>
        <tbody>
          {workOrders.map((workOrder) => (
            <tr key={workOrder.workOrderId} className="border-t">
              <td className="px-3 py-2 font-mono text-xs">{workOrder.workOrderId.slice(0, 8)}…</td>
              <td className="px-3 py-2 font-mono text-xs">{workOrder.workOrderType}</td>
              <td className="px-3 py-2">
                <Badge variant="outline">{workOrder.status}</Badge>
              </td>
              <td className="px-3 py-2">{workOrder.assignedAgent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GrowthAiOsMissionPlanningReviewPanel({ missionId }: { missionId: string }) {
  const missionIdResult = resolveAiOsMissionIdParam(missionId)
  const [readModel, setReadModel] = useState<AiExecutiveMissionPlanningReviewReadModel | null>(null)
  const [preview, setPreview] = useState<AiExecutiveMissionPlanningReviewPreviewResult | null>(null)
  const [approval, setApproval] = useState<AiExecutiveMissionPlanningReviewApproveResult | null>(null)
  const [prepareDecision, setPrepareDecision] = useState(false)
  const [enableAiEvidence, setEnableAiEvidence] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<"preview" | "approve" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadReadModel = useCallback(async () => {
    if (!missionIdResult.ok) return
    const response = await fetch(`/api/platform/growth/ai-os/missions/${missionIdResult.missionId}/planning`, {
      cache: "no-store",
    })
    const body = (await response.json()) as ApiReadResponse
    if (!response.ok || !body.ok || !body.review) {
      throw new Error(body.message ?? body.error ?? "Could not load mission planning review.")
    }
    setReadModel(body.review)
  }, [missionIdResult])

  useEffect(() => {
    if (!missionIdResult.ok) {
      setLoading(false)
      return
    }
    void loadReadModel()
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load mission planning review.")
      })
      .finally(() => setLoading(false))
  }, [loadReadModel, missionIdResult])

  if (!missionIdResult.ok) {
    return <GrowthAiOsMissionPlanningInvalidMissionEmptyState reason={missionIdResult.reason} missionId={missionId} />
  }

  const resolvedMissionId = missionIdResult.missionId

  async function runPreview() {
    setBusy("preview")
    setError(null)
    setApproval(null)
    try {
      const response = await fetch(`/api/platform/growth/ai-os/missions/${resolvedMissionId}/planning/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const body = (await response.json()) as ApiPreviewResponse
      if (!response.ok || !body.ok || !body.preview) {
        throw new Error(body.message ?? body.error ?? "Dry-run preview failed.")
      }
      setPreview(body.preview)
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Dry-run preview failed.")
    } finally {
      setBusy(null)
    }
  }

  async function approvePreview() {
    if (!preview) return
    setBusy("approve")
    setError(null)
    try {
      const response = await fetch(`/api/platform/growth/ai-os/missions/${resolvedMissionId}/planning/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: preview.reviewId,
          executiveRuntimeId: preview.executiveRuntimeId,
          prepareDecision,
          enableAiEvidence,
        }),
      })
      const body = (await response.json()) as ApiApproveResponse
      if (!response.ok || !body.ok || !body.approval) {
        throw new Error(body.message ?? body.error ?? "Work Order creation failed.")
      }
      setApproval(body.approval)
      await loadReadModel()
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Work Order creation failed.")
    } finally {
      setBusy(null)
    }
  }

  if (loading && !readModel) {
    return <p className="text-sm text-muted-foreground">Loading mission planning review…</p>
  }

  if (error && !readModel) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  const mission = preview?.mission ?? readModel?.mission

  return (
    <div
      className="space-y-6"
      data-qa-marker={GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER}
      data-mission-id={resolvedMissionId}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {mission?.title ?? "Mission"}
            {mission?.currentStageId ? <Badge variant="secondary">Stage: {mission.currentStageId}</Badge> : null}
            {mission?.status ? <Badge variant="outline">{mission.status}</Badge> : null}
          </CardTitle>
          <CardDescription>
            Read-only operator review for Executive Mission Planning. Dry-run preview proposes Work Orders without
            creating them. Creation requires explicit approval below — no execution, outbound, or agent claiming.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Mission ID:</span>{" "}
              <span className="font-mono text-xs">{resolvedMissionId}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Objective type:</span> {mission?.objectiveType ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Runtime:</span>{" "}
              {mission?.running ? "Running" : "Not running"}
            </p>
            <p>
              <span className="text-muted-foreground">Executive runtime:</span>{" "}
              <span className="font-mono text-xs">
                {(preview?.executiveRuntimeId ?? readModel?.executiveRuntimeId ?? "—").slice(0, 8)}…
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void runPreview()} disabled={busy !== null}>
              {busy === "preview" ? "Running dry-run…" : "Run dry-run preview"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/growth/objectives">Back to objectives</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Work Orders</CardTitle>
          <CardDescription>Existing non-terminal Work Orders on this mission (duplicate detection context).</CardDescription>
        </CardHeader>
        <CardContent>
          <ActiveWorkOrdersTable workOrders={preview?.activeWorkOrders ?? readModel?.activeWorkOrders ?? []} />
        </CardContent>
      </Card>

      {preview ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Proposed Work Orders</CardTitle>
              <CardDescription>
                Dry-run preview at {new Date(preview.previewedAt).toLocaleString()} — review ID{" "}
                <span className="font-mono text-xs">{preview.reviewId.slice(0, 8)}…</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <WorkOrderProposalTable
                proposals={preview.selectableProposals}
                emptyLabel="No selectable proposals — all items were duplicate-skipped or stage has no bindings."
              />
              {preview.duplicateSkippedProposals.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Duplicate-skipped ({preview.skippedDuplicates})
                  </p>
                  <WorkOrderProposalTable
                    proposals={preview.duplicateSkippedProposals}
                    emptyLabel="No duplicates skipped."
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create Work Orders</CardTitle>
              <CardDescription>
                Explicit operator approval creates issued Work Orders only. Optional Decision Record preparation runs
                during creation when enabled — never during preview.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="prepare-decision"
                    checked={prepareDecision}
                    onCheckedChange={(checked) => setPrepareDecision(checked === true)}
                  />
                  <Label htmlFor="prepare-decision">Prepare Decision Records on create</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="enable-ai-evidence"
                    checked={enableAiEvidence}
                    disabled={!prepareDecision}
                    onCheckedChange={(checked) => setEnableAiEvidence(checked === true)}
                  />
                  <Label htmlFor="enable-ai-evidence">Enable optional AI evidence (requires DR prep)</Label>
                </div>
              </div>
              <Button
                type="button"
                variant="default"
                disabled={busy !== null || preview.selectableProposals.length === 0}
                onClick={() => void approvePreview()}
              >
                {busy === "approve"
                  ? "Creating Work Orders…"
                  : `Create ${preview.selectableProposals.length} Work Order(s)`}
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}

      {approval ? (
        <Card>
          <CardHeader>
            <CardTitle>Created Work Orders</CardTitle>
            <CardDescription>
              Operator approval recorded at {new Date(approval.approvedAt).toLocaleString()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Created <strong>{approval.createdCount}</strong> Work Order(s).
              {approval.prepareDecision ? " Decision Records prepared where applicable." : null}
            </p>
            {approval.created.map((row) => (
              <div key={row.workOrderId} className="rounded-md border px-3 py-2 font-mono text-xs">
                {row.workOrderId} — {row.proposal.workOrderType}
                {row.decisionPreparation?.prepared
                  ? ` · DR ${row.decisionPreparation.decisionRecordId.slice(0, 8)}…`
                  : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
