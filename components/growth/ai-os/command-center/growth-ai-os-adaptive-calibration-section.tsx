"use client"

import { Badge } from "@/components/ui/badge"
import type { GrowthAdaptiveCalibrationReadModel } from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"
import { GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER } from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"
import type { GrowthCalibrationApplyReadModel } from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"
import { GROWTH_CALIBRATION_APPLY_QA_MARKER } from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"

type Props = {
  adaptiveCalibration: GrowthAdaptiveCalibrationReadModel
  calibrationApply?: GrowthCalibrationApplyReadModel
}

function riskVariant(risk: string) {
  if (risk === "high") return "destructive" as const
  if (risk === "medium") return "secondary" as const
  return "outline" as const
}

export function GrowthAiOsAdaptiveCalibrationSection({ adaptiveCalibration, calibrationApply }: Props) {
  if (adaptiveCalibration.qaMarker !== GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER) return null

  const proposed = adaptiveCalibration.proposals.filter((row) => row.status === "proposed")
  const readyToApply = adaptiveCalibration.proposals.filter((row) => row.status === "approved")
  const topProposed = proposed.slice(0, 4)
  const applySummary = calibrationApply?.qaMarker === GROWTH_CALIBRATION_APPLY_QA_MARKER ? calibrationApply.summary : null

  return (
    <section
      id="adaptive-calibration"
      data-qa-section="adaptive-calibration"
      className="space-y-3 rounded-lg border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Adaptive Calibration</h3>
          <p className="text-xs text-muted-foreground">
            Two-step flow: approve proposal, then explicitly apply configuration. Rollback restores prior version.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {adaptiveCalibration.schemaReady ? "Schema ready" : "Schema pending"}
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Proposed</p>
          <p className="text-sm font-medium">{adaptiveCalibration.summary.proposedCount}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Ready to apply</p>
          <p className="text-sm font-medium">{applySummary?.readyToApplyCount ?? readyToApply.length}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Active versions</p>
          <p className="text-sm font-medium">{applySummary?.activeCalibrationCount ?? 0}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Rollback available</p>
          <p className="text-sm font-medium">{applySummary?.rollbackAvailableCount ?? 0}</p>
        </div>
      </div>

      {applySummary?.lastAppliedAt ? (
        <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
          Last applied: {new Date(applySummary.lastAppliedAt).toLocaleString()}
          {applySummary.lastAppliedTargetSystem
            ? ` · ${applySummary.lastAppliedTargetSystem.replace(/_/g, " ")}`
            : ""}
          {applySummary.lastAppliedConfidence != null
            ? ` · confidence ${Math.round(applySummary.lastAppliedConfidence * 100)}%`
            : ""}
        </div>
      ) : null}

      {adaptiveCalibration.summary.highestImpactTitle ? (
        <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
          Highest impact: {adaptiveCalibration.summary.highestImpactTitle}
        </div>
      ) : null}

      {topProposed.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Proposed calibrations</p>
          {topProposed.map((proposal) => (
            <div key={proposal.id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{proposal.title}</p>
                <Badge variant={riskVariant(proposal.riskLevel)}>{proposal.riskLevel} risk</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{proposal.summary}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Target: {proposal.targetSystem.replace(/_/g, " ")}</span>
                <span>Type: {proposal.proposalType.replace(/_/g, " ")}</span>
                <span>Sample: {proposal.sampleSize}</span>
                <span>Confidence: {Math.round(proposal.confidence * 100)}%</span>
                <span>Impact: {Math.round(proposal.impact * 100)}%</span>
              </div>
              {proposal.evidence.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {proposal.evidence.slice(0, 3).map((row, index) => (
                    <p key={`${proposal.id}-evidence-${index}`} className="text-xs text-muted-foreground">
                      {row.label}: {String(row.value ?? "—")}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {readyToApply.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Ready to apply (explicit operator action required)</p>
          {readyToApply.slice(0, 3).map((proposal) => (
            <div key={proposal.id} className="rounded border border-dashed px-2 py-1 text-xs">
              {proposal.title} · {proposal.targetSystem.replace(/_/g, " ")}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
