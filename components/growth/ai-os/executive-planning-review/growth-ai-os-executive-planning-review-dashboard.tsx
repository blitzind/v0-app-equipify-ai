"use client"

import type { AiOsExecutMissionPlanningActiveWorkOrderSummary } from "@/lib/growth/aios/ai-executive-mission-planning-review-types"
import type { AiOsExecutMissionPlanningReviewPreviewResult } from "@/lib/growth/aios/ai-executive-mission-planning-review-types"
import type { AiExecutivePlanningReport } from "@/lib/growth/aios/ai-executive-planning-report-types"
import type { AiExecutiveMissionPlanningLeadResearchExecutionPlanSummary } from "@/lib/growth/aios/ai-executive-mission-planning-review-types"
import { GROWTH_AI_EXECUTIVE_PLANNING_REVIEW_UX_QA_MARKER } from "@/lib/growth/aios/ai-executive-planning-review-ux-types"
import { GrowthAiOsLeadResearchExecutionPlanSection } from "@/components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section"
import { GrowthAiOsActiveWorkOrdersCollapsible } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-active-work-orders-collapsible"
import { GrowthAiOsApprovalActionCard } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-approval-action-card"
import { GrowthAiOsBusinessOutcomesSection, GrowthAiOsRiskCardsSection } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-business-outcomes-section"
import { GrowthAiOsExecutReasoningCollapsible } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-executive-reasoning-collapsible"
import { GrowthAiOsExecutSummarySection } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-executive-summary-section"
import { GrowthAiOsMissionProgressTrack } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-mission-progress-track"
import { GrowthAiOsProposedWorkOrdersSection } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-proposed-work-orders-section"
import { GrowthAiOsWorkOrderRoadmap } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-work-order-roadmap"

export function GrowthAiOsExecutPlanningReviewDashboard({
  report,
  preview,
  previewLoading,
  activeWorkOrders,
  leadResearchExecutionPlans = [],
  prepareDecision,
  enableAiEvidence,
  onPrepareDecisionChange,
  onEnableAiEvidenceChange,
  onApprove,
  onRunPreview,
  busy,
}: {
  report: AiOsExecutPlanningReport
  preview: AiOsExecutMissionPlanningReviewPreviewResult | null
  previewLoading: boolean
  activeWorkOrders: AiOsExecutMissionPlanningActiveWorkOrderSummary[]
  leadResearchExecutionPlans?: AiExecutiveMissionPlanningLeadResearchExecutionPlanSummary[]
  prepareDecision: boolean
  enableAiEvidence: boolean
  onPrepareDecisionChange: (value: boolean) => void
  onEnableAiEvidenceChange: (value: boolean) => void
  onApprove: () => void
  onRunPreview: () => void
  busy: "preview" | "approve" | null
}) {
  const proposals = preview?.selectableProposals ?? []
  const activeTypes = (preview?.activeWorkOrders ?? activeWorkOrders).map((row) => row.workOrderType)

  return (
    <div
      className="space-y-6"
      data-qa-marker={GROWTH_AI_EXECUTIVE_PLANNING_REVIEW_UX_QA_MARKER}
    >
      <GrowthAiOsExecutSummarySection report={report} proposals={proposals} />

      {leadResearchExecutionPlans.length > 0 ? (
        <div className="space-y-4" data-qa-section="lead-research-planning-review">
          {leadResearchExecutionPlans.map((entry) => (
            <GrowthAiOsLeadResearchExecutionPlanSection
              key={entry.leadId}
              plan={entry.executionPlan}
              approvalStatus={entry.approvalStatus}
              readinessState={entry.readinessState}
              readinessReason={entry.readinessReason}
              futureExecutionSummary={entry.futureExecutionSummary}
              auditTrailSummary={entry.auditTrailSummary}
              handoffState={entry.handoffState}
              handoffSummary={entry.handoffSummary}
              boundaryClassification={entry.boundaryClassification}
              boundarySummary={entry.boundarySummary}
              boundaryWarnings={entry.boundaryWarnings}
              preflightStatus={entry.preflightStatus}
              preflightSummary={entry.preflightSummary}
              preflightMissingRequirements={entry.preflightMissingRequirements}
              simulationStatus={entry.simulationStatus}
              simulationSummary={entry.simulationSummary}
              simulatedSuccessProbability={entry.simulatedSuccessProbability}
              runtimeState={entry.runtimeState}
              runtimeSummary={entry.runtimeSummary}
              dryRunEligible={entry.dryRunEligible}
              dryRunSummary={entry.dryRunSummary}
              dryRunBlockedReasons={entry.dryRunBlockedReasons}
              latestDryRunStatus={entry.latestDryRunStatus}
              compact
              title={`Planning Review · ${entry.companyName ?? entry.leadId.slice(0, 8)}`}
              description="Lead research execution plan — read-only, no Work Order execution."
            />
          ))}
        </div>
      ) : null}

      <GrowthAiOsMissionProgressTrack
        stageId={report.currentStage.stageId}
        stageLabel={report.currentStage.label}
        progressPercent={report.missionSummary.progress.percent}
      />

      <GrowthAiOsWorkOrderRoadmap steps={report.multiStepWorkOrderPlan} activeWorkOrderTypes={activeTypes} />

      <GrowthAiOsProposedWorkOrdersSection
        proposals={proposals}
        duplicateProposals={preview?.duplicateSkippedProposals ?? []}
        previewedAt={preview?.previewedAt ?? null}
        loading={previewLoading && !preview}
        onRefreshPreview={onRunPreview}
        busy={busy !== null}
      />

      <GrowthAiOsApprovalActionCard
        report={report}
        workOrderCount={proposals.length}
        prepareDecision={prepareDecision}
        enableAiEvidence={enableAiEvidence}
        onPrepareDecisionChange={onPrepareDecisionChange}
        onEnableAiEvidenceChange={onEnableAiEvidenceChange}
        onApprove={onApprove}
        onRunPreview={onRunPreview}
        busy={busy}
        previewReady={Boolean(preview)}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthAiOsBusinessOutcomesSection report={report} />
        <GrowthAiOsRiskCardsSection report={report} />
      </div>

      <GrowthAiOsActiveWorkOrdersCollapsible workOrders={preview?.activeWorkOrders ?? activeWorkOrders} />

      <GrowthAiOsExecutReasoningCollapsible report={report} />
    </div>
  )
}
