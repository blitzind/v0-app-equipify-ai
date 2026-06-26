"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import { GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_QA_MARKER } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchExecutionPlanApprovalStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import type { GrowthLeadResearchApprovedPlanReadinessState } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"
import type { GrowthLeadResearchFutureExecutionHandoffState } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import type { GrowthLeadResearchExecutionBoundaryClassification } from "@/lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import type { GrowthLeadResearchExecutionPreflightStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-preflight-types"
import type { GrowthLeadResearchExecutionSimulationStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-simulation-types"
import type { GrowthLeadResearchExecutionState } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import type { GrowthLeadResearchExecutionDryRunStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-types"
import type { GrowthAgentPlanContext } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { RevenueOperatorOrchestrationPlanContext } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import type { GrowthAgentEventPlanContext } from "@/lib/growth/aios/growth/growth-agent-event-types"
import type { GrowthAgentMemoryPlanContext } from "@/lib/growth/aios/growth/growth-agent-memory-types"
import type { GrowthMissionPlanContext } from "@/lib/growth/aios/growth/growth-mission-framework-types"
import type { GrowthMissionPriorityPlanContext } from "@/lib/growth/aios/growth/growth-mission-priority-types"
import type { GrowthSchedulerReadinessPlanContext } from "@/lib/growth/aios/growth/growth-scheduler-readiness-types"
import type { GrowthAutonomousPlanningPilotPlanContext } from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-types"
import type { GrowthAutonomousQualificationPilotPlanContext } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import type { GrowthAutonomousResearchPilotPlanContext } from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-types"
import { cn } from "@/lib/utils"

function readinessBadgeVariant(readiness: GrowthLeadResearchExecutionPlan["executionReadiness"]) {
  if (readiness === "ready") return "secondary" as const
  if (readiness === "needs_approval") return "default" as const
  if (readiness === "blocked") return "destructive" as const
  return "outline" as const
}

export function GrowthAiOsLeadResearchExecutionPlanSection({
  plan,
  title = "Execution Plan",
  description = "Planning-only workflow map — no Work Orders are created from this surface.",
  compact = false,
  approvalStatus,
  readinessState,
  readinessReason,
  futureExecutionSummary,
  auditTrailSummary,
  handoffState,
  handoffSummary,
  boundaryClassification,
  boundarySummary,
  boundaryWarnings = [],
  preflightStatus,
  preflightSummary,
  preflightMissingRequirements = [],
  simulationStatus,
  simulationSummary,
  simulatedSuccessProbability,
  runtimeState,
  runtimeSummary,
  dryRunEligible,
  dryRunSummary,
  dryRunBlockedReasons = [],
  latestDryRunStatus,
  pilotEligible,
  pilotSummary,
  pilotBlockedReasons = [],
  pilotEnabled,
  runtimeEnabled,
  dryRunRequired,
  agentContext,
  orchestrationContext,
  agentEventContext,
  agentMemoryContext,
  missionPlanContext,
  missionPriorityContext,
  schedulerReadinessContext,
  autonomousResearchPilotContext,
  autonomousQualificationPilotContext,
  autonomousPlanningPilotContext,
}: {
  plan: GrowthLeadResearchExecutionPlan
  title?: string
  description?: string
  compact?: boolean
  approvalStatus?: GrowthLeadResearchExecutionPlanApprovalStatus
  readinessState?: GrowthLeadResearchApprovedPlanReadinessState | null
  readinessReason?: string | null
  futureExecutionSummary?: string | null
  auditTrailSummary?: string | null
  handoffState?: GrowthLeadResearchFutureExecutionHandoffState | null
  handoffSummary?: string | null
  boundaryClassification?: GrowthLeadResearchExecutionBoundaryClassification | null
  boundarySummary?: string | null
  boundaryWarnings?: string[]
  preflightStatus?: GrowthLeadResearchExecutionPreflightStatus | null
  preflightSummary?: string | null
  preflightMissingRequirements?: string[]
  simulationStatus?: GrowthLeadResearchExecutionSimulationStatus | null
  simulationSummary?: string | null
  simulatedSuccessProbability?: number | null
  runtimeState?: GrowthLeadResearchExecutionState | null
  runtimeSummary?: string | null
  dryRunEligible?: boolean
  dryRunSummary?: string | null
  dryRunBlockedReasons?: string[]
  latestDryRunStatus?: GrowthLeadResearchExecutionDryRunStatus | null
  pilotEligible?: boolean
  pilotSummary?: string | null
  pilotBlockedReasons?: string[]
  pilotEnabled?: boolean
  runtimeEnabled?: boolean
  dryRunRequired?: boolean
  agentContext?: GrowthAgentPlanContext | null
  orchestrationContext?: RevenueOperatorOrchestrationPlanContext | null
  agentEventContext?: GrowthAgentEventPlanContext | null
  agentMemoryContext?: GrowthAgentMemoryPlanContext | null
  missionPlanContext?: GrowthMissionPlanContext | null
  missionPriorityContext?: GrowthMissionPriorityPlanContext | null
  schedulerReadinessContext?: GrowthSchedulerReadinessPlanContext | null
  autonomousResearchPilotContext?: GrowthAutonomousResearchPilotPlanContext | null
  autonomousQualificationPilotContext?: GrowthAutonomousQualificationPilotPlanContext | null
  autonomousPlanningPilotContext?: GrowthAutonomousPlanningPilotPlanContext | null
}) {
  return (
    <Card data-qa-marker={GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_QA_MARKER} data-qa-section="execution-plan">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={cn("space-y-4 text-sm", compact && "space-y-3")}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{plan.workflowType.replaceAll("_", " ")}</Badge>
          <Badge variant={readinessBadgeVariant(plan.executionReadiness)}>
            {plan.executionReadiness.replaceAll("_", " ")}
          </Badge>
          {plan.approvalRequired ? <Badge variant="secondary">Approval required</Badge> : null}
          {approvalStatus ? (
            <Badge variant="outline">{approvalStatus.replaceAll("_", " ")}</Badge>
          ) : null}
          {readinessState ? (
            <Badge variant={readinessState === "ready_for_future_execution" ? "secondary" : "destructive"}>
              {readinessState.replaceAll("_", " ")}
            </Badge>
          ) : null}
        </div>

        {readinessReason ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Readiness:</span> {readinessReason}
          </p>
        ) : null}
        {futureExecutionSummary ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Future phase:</span> {futureExecutionSummary}
          </p>
        ) : null}
        {auditTrailSummary ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Audit trail:</span> {auditTrailSummary}
          </p>
        ) : null}
        {handoffState ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Handoff ({handoffState.replaceAll("_", " ")}):</span>{" "}
            {handoffSummary}
          </p>
        ) : null}
        {boundaryClassification ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Boundary ({boundaryClassification.replaceAll("_", " ")}):</span>{" "}
            {boundarySummary}
          </p>
        ) : null}
        {boundaryWarnings.length > 0 ? (
          <p className="text-sm text-amber-700">
            Boundary warning: {boundaryWarnings[0]}
          </p>
        ) : null}
        {preflightStatus ? (
          <div className="space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  preflightStatus === "preflight_passed"
                    ? "secondary"
                    : preflightStatus === "preflight_not_allowed"
                      ? "outline"
                      : "destructive"
                }
              >
                Preflight · {preflightStatus.replaceAll("_", " ")}
              </Badge>
            </div>
            {preflightSummary ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Preflight:</span> {preflightSummary}
              </p>
            ) : null}
            {preflightMissingRequirements.length > 0 ? (
              <p className="text-amber-700">
                Missing: {preflightMissingRequirements.slice(0, compact ? 2 : 5).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {simulationStatus ? (
          <div className="space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  simulationStatus === "simulation_success"
                    ? "secondary"
                    : simulationStatus === "simulation_not_allowed"
                      ? "outline"
                      : "default"
                }
              >
                Simulation · {simulationStatus.replaceAll("_", " ")}
              </Badge>
              {simulatedSuccessProbability != null ? (
                <Badge variant="outline">{Math.round(simulatedSuccessProbability * 100)}% success probability</Badge>
              ) : null}
            </div>
            {simulationSummary ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Simulation:</span> {simulationSummary}
              </p>
            ) : null}
          </div>
        ) : null}
        {runtimeState ? (
          <div className="space-y-1 text-sm">
            <Badge variant={runtimeState === "completed" ? "secondary" : runtimeState === "failed" ? "destructive" : "outline"}>
              Runtime · {runtimeState.replaceAll("_", " ")}
            </Badge>
            {runtimeSummary ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Runtime:</span> {runtimeSummary}
              </p>
            ) : null}
          </div>
        ) : null}
        {dryRunEligible != null ? (
          <div className="space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={dryRunEligible ? "secondary" : "outline"}>
                Dry-run · {dryRunEligible ? "eligible" : "not eligible"}
              </Badge>
              {latestDryRunStatus ? (
                <Badge variant={latestDryRunStatus === "dry_run_passed" ? "secondary" : "outline"}>
                  Latest · {latestDryRunStatus.replaceAll("_", " ")}
                </Badge>
              ) : null}
              <Badge variant="outline">Non-persistent</Badge>
            </div>
            {dryRunSummary ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Dry-run:</span> {dryRunSummary}
              </p>
            ) : null}
            {dryRunBlockedReasons.length > 0 ? (
              <p className="text-amber-700">
                Blocked: {dryRunBlockedReasons.slice(0, compact ? 2 : 5).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {pilotEligible != null || pilotSummary ? (
          <div className="space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={pilotEligible ? "secondary" : "outline"}>
                Runtime pilot · {pilotEligible ? "eligible" : "not eligible"}
              </Badge>
              {pilotEnabled != null ? (
                <Badge variant={pilotEnabled ? "secondary" : "outline"}>
                  Pilot {pilotEnabled ? "enabled" : "disabled"}
                </Badge>
              ) : null}
              {runtimeEnabled != null ? (
                <Badge variant={runtimeEnabled ? "secondary" : "outline"}>
                  Runtime {runtimeEnabled ? "enabled" : "disabled"}
                </Badge>
              ) : null}
              {dryRunRequired ? <Badge variant="outline">Dry-run required before enqueue</Badge> : null}
            </div>
            {pilotSummary ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Pilot:</span> {pilotSummary}
              </p>
            ) : null}
            {pilotBlockedReasons.length > 0 ? (
              <p className="text-amber-700">
                Blocked: {pilotBlockedReasons.slice(0, compact ? 2 : 5).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {agentContext ? (
          <div className="space-y-1 text-sm" data-qa-section="agent-context">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={agentContext.agentAllowed ? "secondary" : "outline"}>
                Agent · {agentContext.owningAgentName}
              </Badge>
              <Badge variant="outline">{agentContext.permissionProfile.replaceAll("_", " ")}</Badge>
              <Badge variant="outline">
                Run · {agentContext.runContractPreview.runStatus.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Agent:</span> {agentContext.agentSummary}
            </p>
            {agentContext.requiredGates.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Required gates: {agentContext.requiredGates.join(" · ")}
              </p>
            ) : null}
            {agentContext.blockedReasons.length > 0 ? (
              <p className="text-amber-700">
                Blocked: {agentContext.blockedReasons.slice(0, compact ? 2 : 5).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {orchestrationContext ? (
          <div className="space-y-1 text-sm" data-qa-section="orchestration-context">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                Revenue Operator · {orchestrationContext.orchestrationDecision.replaceAll("_", " ")}
              </Badge>
              <Badge variant="outline">
                Escalation · {orchestrationContext.escalationLevel}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Owner:</span>{" "}
              {orchestrationContext.currentOwner.replaceAll("_", " ")} →{" "}
              {orchestrationContext.nextOwner.replaceAll("_", " ")}
            </p>
            {orchestrationContext.handoffSummary ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Handoff:</span>{" "}
                {orchestrationContext.handoffSummary}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Reasoning:</span>{" "}
              {orchestrationContext.orchestrationReasoning}
            </p>
            {orchestrationContext.blockedReasons.length > 0 ? (
              <p className="text-amber-700">
                Blocked: {orchestrationContext.blockedReasons.slice(0, compact ? 2 : 5).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {agentEventContext ? (
          <div className="space-y-1 text-sm" data-qa-section="agent-event-context">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                Event · {agentEventContext.latestTriggeringEvent.replaceAll("_", " ")}
              </Badge>
              <Badge variant="outline">
                Queue · {agentEventContext.queueStatus.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Owner:</span>{" "}
              {agentEventContext.owningAgent.replaceAll("_", " ")} · Routed:{" "}
              {agentEventContext.routedAgent.replaceAll("_", " ")}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Trigger:</span>{" "}
              {agentEventContext.latestTriggeringReason}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Routing:</span>{" "}
              {agentEventContext.routingExplanation}
            </p>
          </div>
        ) : null}
        {agentMemoryContext ? (
          <div className="space-y-1 text-sm" data-qa-section="agent-memory-context">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                Memory · {agentMemoryContext.completenessState.replaceAll("_", " ")}
              </Badge>
              <Badge variant="outline">
                Owner · {agentMemoryContext.owningAgent.replaceAll("_", " ")}
              </Badge>
            </div>
            {agentMemoryContext.missingContext.length > 0 ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Missing:</span>{" "}
                {agentMemoryContext.missingContext.slice(0, compact ? 2 : 5).join(" · ")}
              </p>
            ) : null}
            {agentMemoryContext.conflicts.length > 0 ? (
              <p className="text-amber-800">
                Conflicts:{" "}
                {agentMemoryContext.conflicts.slice(0, compact ? 1 : 3).map((c) => c.summary).join(" · ")}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Remediation:</span>{" "}
              {agentMemoryContext.recommendedRemediation}
            </p>
          </div>
        ) : null}
        {missionPlanContext ? (
          <div className="space-y-1 text-sm" data-qa-section="mission-plan-context">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                Mission · {missionPlanContext.primaryMissionType?.replaceAll("_", " ") ?? "planned"}
              </Badge>
              <Badge variant="outline">
                Health · {missionPlanContext.health.state}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Summary:</span>{" "}
              {missionPlanContext.missionSummary}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Stage:</span>{" "}
              {missionPlanContext.currentStage.replaceAll("_", " ")} · Owner:{" "}
              {missionPlanContext.ownerAgent.replaceAll("_", " ")}
            </p>
            {missionPlanContext.blockers.length > 0 ? (
              <p className="text-amber-800">
                Blockers: {missionPlanContext.blockers.slice(0, compact ? 2 : 4).join(" · ")}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Next milestone:</span>{" "}
              {missionPlanContext.recommendedNextMilestone}
            </p>
          </div>
        ) : null}
        {missionPriorityContext ? (
          <div className="space-y-1 text-sm" data-qa-section="mission-priority-context">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                Priority {missionPriorityContext.missionPriority.overallPriority}
              </Badge>
              <Badge variant="outline">
                Queue · {missionPriorityContext.queueBucket.replaceAll("_", " ")}
              </Badge>
              <Badge variant="secondary">ROI {missionPriorityContext.estimatedRoi}</Badge>
              <Badge variant="outline">Urgency {missionPriorityContext.urgencyScore}</Badge>
            </div>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Allocation:</span>{" "}
              {missionPriorityContext.allocationReason}
            </p>
            {missionPriorityContext.deferReason ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Defer:</span>{" "}
                {missionPriorityContext.deferReason}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Recommended:</span>{" "}
              {missionPriorityContext.recommendedAction}
            </p>
          </div>
        ) : null}
        {schedulerReadinessContext ? (
          <div className="space-y-1 text-sm" data-qa-section="scheduler-readiness-context">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                Scheduler · {schedulerReadinessContext.schedulerEligibility.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Queue:</span>{" "}
              {schedulerReadinessContext.queueSource}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Wake:</span>{" "}
              {schedulerReadinessContext.wakeRecommendation}
            </p>
            {schedulerReadinessContext.blockedReasons.length > 0 ? (
              <p className="text-amber-800">
                Blocked:{" "}
                {schedulerReadinessContext.blockedReasons.slice(0, compact ? 2 : 4).join(" · ")}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Budget:</span>{" "}
              {schedulerReadinessContext.cooldownBudgetSummary}
            </p>
          </div>
        ) : null}
        {autonomousResearchPilotContext ? (
          <div className="space-y-1 text-sm" data-qa-section="autonomous-research-pilot-context">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                Research · {autonomousResearchPilotContext.autonomousResearchStatus.replaceAll("_", " ")}
              </Badge>
              <Badge variant="outline">
                Stale · {autonomousResearchPilotContext.staleStatus}
              </Badge>
              {autonomousResearchPilotContext.confidence != null ? (
                <Badge variant="secondary">
                  Confidence {autonomousResearchPilotContext.confidence}
                </Badge>
              ) : null}
            </div>
            {autonomousResearchPilotContext.lastRefreshAt ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Last refresh:</span>{" "}
                {autonomousResearchPilotContext.lastRefreshAt}
              </p>
            ) : null}
            {autonomousResearchPilotContext.nextScheduledRefresh ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Next refresh:</span>{" "}
                {autonomousResearchPilotContext.nextScheduledRefresh}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Wake:</span>{" "}
              {autonomousResearchPilotContext.wakeRecommendation}
            </p>
          </div>
        ) : null}

        {autonomousQualificationPilotContext ? (
          <div className="space-y-1 text-sm" data-qa-section="autonomous-qualification-pilot-context">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                Qualification · {autonomousQualificationPilotContext.qualificationStatus.replaceAll("_", " ")}
              </Badge>
              <Badge variant="outline">
                Owner · {autonomousQualificationPilotContext.qualificationAgentOwner.replaceAll("_", " ")}
              </Badge>
              {autonomousQualificationPilotContext.confidence != null ? (
                <Badge variant="secondary">
                  Confidence {autonomousQualificationPilotContext.confidence}
                </Badge>
              ) : null}
              {autonomousQualificationPilotContext.icpFitScore != null ? (
                <Badge variant="secondary">Fit {autonomousQualificationPilotContext.icpFitScore}</Badge>
              ) : null}
            </div>
            {autonomousQualificationPilotContext.blockedReason ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Blocked:</span>{" "}
                {autonomousQualificationPilotContext.blockedReason}
              </p>
            ) : null}
            {autonomousQualificationPilotContext.revenueOperatorHandoff ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Handoff:</span>{" "}
                {autonomousQualificationPilotContext.revenueOperatorHandoff.replaceAll("_", " ")}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Wake:</span>{" "}
              {autonomousQualificationPilotContext.wakeRecommendation}
            </p>
          </div>
        ) : null}

        {autonomousPlanningPilotContext ? (
          <div className="space-y-1 text-sm" data-qa-section="autonomous-planning-pilot-context">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                Planning · {autonomousPlanningPilotContext.planningStatus.replaceAll("_", " ")}
              </Badge>
              <Badge variant="outline">
                Owner · {autonomousPlanningPilotContext.planningAgentOwner.replaceAll("_", " ")}
              </Badge>
              {autonomousPlanningPilotContext.confidence != null ? (
                <Badge variant="secondary">
                  Confidence {autonomousPlanningPilotContext.confidence}
                </Badge>
              ) : null}
              {autonomousPlanningPilotContext.executionReadiness ? (
                <Badge variant="secondary">
                  {autonomousPlanningPilotContext.executionReadiness.replaceAll("_", " ")}
                </Badge>
              ) : null}
            </div>
            {autonomousPlanningPilotContext.blockedReason ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Blocked:</span>{" "}
                {autonomousPlanningPilotContext.blockedReason}
              </p>
            ) : null}
            {autonomousPlanningPilotContext.requiredApprovals.length > 0 ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Approvals:</span>{" "}
                {autonomousPlanningPilotContext.requiredApprovals.join(" · ")}
              </p>
            ) : null}
            {autonomousPlanningPilotContext.prerequisites.length > 0 ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Prerequisites:</span>{" "}
                {autonomousPlanningPilotContext.prerequisites.slice(0, 3).join(" · ")}
              </p>
            ) : null}
            {autonomousPlanningPilotContext.revenueOperatorHandoff ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Handoff:</span>{" "}
                {autonomousPlanningPilotContext.revenueOperatorHandoff.replaceAll("_", " ")}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Wake:</span>{" "}
              {autonomousPlanningPilotContext.wakeRecommendation}
            </p>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Next best action:</span> {plan.nextBestAction}
          </p>
          <p>
            <span className="text-muted-foreground">Duration:</span> {plan.estimatedDuration}
          </p>
          <p>
            <span className="text-muted-foreground">Effort / cost:</span> {plan.estimatedCost}
          </p>
          <p>
            <span className="text-muted-foreground">Expected outcome:</span> {plan.expectedOutcome}
          </p>
        </div>

        {!compact ? (
          <>
            <div>
              <p className="font-medium">Estimated steps</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {plan.estimatedSteps.map((step) => (
                  <li key={step.stepId}>
                    {step.label}
                    {step.workOrderType ? ` · ${step.workOrderType.replaceAll("_", " ")}` : null}
                  </li>
                ))}
              </ul>
            </div>

            {plan.requiredWorkOrders.length > 0 ? (
              <div>
                <p className="font-medium">Required Work Orders (future)</p>
                <p className="mt-1 text-muted-foreground">
                  {plan.requiredWorkOrders.map((type) => type.replaceAll("_", " ")).join(" · ")}
                </p>
              </div>
            ) : null}

            {plan.prerequisites.length > 0 ? (
              <div>
                <p className="font-medium">Prerequisites</p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {plan.prerequisites.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {plan.missingPrerequisites.length > 0 ? (
              <div>
                <p className="font-medium text-amber-700">Missing prerequisites</p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {plan.missingPrerequisites.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="font-medium">Success criteria</p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {plan.successCriteria.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium">Failure conditions</p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  {plan.failureConditions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Rollback:</span> {plan.rollbackStrategy}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
