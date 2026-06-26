"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GrowthAiOsExecutPlanningReviewDashboard } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-review-dashboard"
import {
  GROWTH_AI_OS_SAFE_INDEX_HREF,
  aiOsMissionIdValidationMessage,
  resolveAiOsMissionIdParam,
  type AiOsMissionIdValidationFailureReason,
} from "@/lib/growth/aios/ai-os-mission-route-params"
import type {
  AiOsExecutMissionPlanningReviewApproveResult,
  AiOsExecutMissionPlanningReviewPreviewResult,
  AiOsExecutMissionPlanningReviewReadModel,
} from "@/lib/growth/aios/ai-executive-mission-planning-review-types"
import { GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER } from "@/lib/growth/aios/ai-executive-mission-planning-review-types"

type ApiReadResponse = {
  ok?: boolean
  review?: AiOsExecutMissionPlanningReviewReadModel
  message?: string
  error?: string
}

type ApiPreviewResponse = {
  ok?: boolean
  preview?: AiOsExecutMissionPlanningReviewPreviewResult
  message?: string
  error?: string
}

type ApiApproveResponse = {
  ok?: boolean
  approval?: AiOsExecutMissionPlanningReviewApproveResult
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

export function GrowthAiOsMissionPlanningReviewPanel({ missionId }: { missionId: string }) {
  const missionIdResult = resolveAiOsMissionIdParam(missionId)
  const [readModel, setReadModel] = useState<AiOsExecutMissionPlanningReviewReadModel | null>(null)
  const [preview, setPreview] = useState<AiOsExecutMissionPlanningReviewPreviewResult | null>(null)
  const [approval, setApproval] = useState<AiOsExecutMissionPlanningReviewApproveResult | null>(null)
  const [prepareDecision, setPrepareDecision] = useState(false)
  const [enableAiEvidence, setEnableAiEvidence] = useState(false)
  const [loading, setLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
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

  const runPreview = useCallback(async () => {
    if (!missionIdResult.ok) return
    setBusy("preview")
    setPreviewLoading(true)
    setError(null)
    setApproval(null)
    try {
      const response = await fetch(`/api/platform/growth/ai-os/missions/${missionIdResult.missionId}/planning/preview`, {
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
      setPreviewLoading(false)
    }
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

  useEffect(() => {
    if (!readModel || preview || previewLoading || busy) return
    void runPreview()
  }, [readModel, preview, previewLoading, busy, runPreview])

  if (!missionIdResult.ok) {
    return <GrowthAiOsMissionPlanningInvalidMissionEmptyState reason={missionIdResult.reason} missionId={missionId} />
  }

  const resolvedMissionId = missionIdResult.missionId

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
      await runPreview()
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

  if (!readModel?.executivePlanningReport) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Planning review unavailable</CardTitle>
          <CardDescription>Could not load executive planning intelligence for this mission.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div
      className="space-y-6"
      data-qa-marker={GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER}
      data-mission-id={resolvedMissionId}
    >
      <GrowthAiOsExecutPlanningReviewDashboard
        report={readModel.executivePlanningReport}
        preview={preview}
        previewLoading={previewLoading}
        activeWorkOrders={readModel.activeWorkOrders}
        leadResearchExecutionPlans={readModel.leadResearchExecutionPlans}
        prepareDecision={prepareDecision}
        enableAiEvidence={enableAiEvidence}
        onPrepareDecisionChange={setPrepareDecision}
        onEnableAiEvidenceChange={setEnableAiEvidence}
        onApprove={() => void approvePreview()}
        onRunPreview={() => void runPreview()}
        busy={busy}
      />

      {approval ? (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader>
            <CardTitle>Work Orders created</CardTitle>
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
              <div key={row.workOrderId} className="rounded-md border bg-background px-3 py-2 font-mono text-xs">
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
