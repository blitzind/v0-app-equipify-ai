"use client"

import Link from "next/link"
import { Activity, Bot, Cpu, Flag, Radar, ShieldAlert, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { GrowthAiOsKpiCard } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-ux-utils"
import { GrowthAiOsApprovedPlanReadinessSection } from "@/components/growth/ai-os/command-center/growth-ai-os-approved-plan-readiness-section"
import { GrowthAiOsAgentEventsSection } from "@/components/growth/ai-os/command-center/growth-ai-os-agent-events-section"
import { GrowthAiOsAgentFrameworkSection } from "@/components/growth/ai-os/command-center/growth-ai-os-agent-framework-section"
import { GrowthAiOsAgentMemorySection } from "@/components/growth/ai-os/command-center/growth-ai-os-agent-memory-section"
import { GrowthAiOsAutonomousResearchPilotSection } from "@/components/growth/ai-os/command-center/growth-ai-os-autonomous-research-pilot-section"
import { GrowthAiOsExecutionBoundaryAuditSection } from "@/components/growth/ai-os/command-center/growth-ai-os-execution-boundary-audit-section"
import { GrowthAiOsExecutionPlanReviewSection } from "@/components/growth/ai-os/command-center/growth-ai-os-execution-plan-review-section"
import { GrowthAiOsExecutionPreflightChecklistSection } from "@/components/growth/ai-os/command-center/growth-ai-os-execution-preflight-checklist-section"
import { GrowthAiOsExecutionRuntimeSection } from "@/components/growth/ai-os/command-center/growth-ai-os-execution-runtime-section"
import { GrowthAiOsExecutionSimulationSection } from "@/components/growth/ai-os/command-center/growth-ai-os-execution-simulation-section"
import { GrowthAiOsFutureExecutionHandoffSection } from "@/components/growth/ai-os/command-center/growth-ai-os-future-execution-handoff-section"
import { GrowthAiOsGrowthLeadResearchWorkflowSection } from "@/components/growth/ai-os/command-center/growth-ai-os-growth-lead-research-workflow-section"
import { GrowthAiOsMissionPrioritiesSection } from "@/components/growth/ai-os/command-center/growth-ai-os-mission-priorities-section"
import { GrowthAiOsMissionsSection } from "@/components/growth/ai-os/command-center/growth-ai-os-missions-section"
import { GrowthAiOsRevenueOperatorSection } from "@/components/growth/ai-os/command-center/growth-ai-os-revenue-operator-section"
import { GrowthAiOsSchedulerReadinessSection } from "@/components/growth/ai-os/command-center/growth-ai-os-scheduler-readiness-section"
import { GrowthAiOsOperationsSectionCard } from "@/components/growth/ai-os/operations/growth-ai-os-operations-section-card"
import type { AiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-types"
import { buildAiOsPilotLeadResearchHref } from "@/lib/growth/aios/ai-os-public-routes"
import { cn } from "@/lib/utils"

function severityTone(severity: "high" | "medium" | "low") {
  if (severity === "high") return "border-rose-200 bg-rose-50/70"
  if (severity === "medium") return "border-amber-200 bg-amber-50/70"
  return "border-border bg-muted/20"
}

export function GrowthAiOsCommandCenterDiagnosticsSections({
  model,
  onRefresh,
}: {
  model: AiOsCommandCenterReadModel
  onRefresh: () => void
}) {
  return (
    <div className="space-y-6 border-t border-dashed border-border pt-6" data-qa-section="engineering-diagnostics">
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm text-amber-900">
        Engineering diagnostics mode — full AI OS phase sections (1A–5B) for implementation review.
      </div>

      <GrowthAiOsGrowthLeadResearchWorkflowSection workflow={model.growthLeadResearchWorkflow} />

      <div id="execution-plan-review">
        <GrowthAiOsExecutionPlanReviewSection
          queue={model.executionPlanReviewQueue}
          onQueueUpdated={onRefresh}
        />
      </div>

      <GrowthAiOsApprovedPlanReadinessSection approvedPlans={model.approvedPlanReadinessQueue} />

      <GrowthAiOsFutureExecutionHandoffSection handoffContracts={model.futureExecutionHandoffContracts} />

      <GrowthAiOsExecutionBoundaryAuditSection audit={model.executionBoundaryAudit} />

      <GrowthAiOsExecutionPreflightChecklistSection preflight={model.executionPreflightChecklist} />

      <GrowthAiOsExecutionSimulationSection simulation={model.executionSimulation} />

      <GrowthAiOsExecutionRuntimeSection executionRuntime={model.executionRuntime} onRefresh={onRefresh} />

      <GrowthAiOsAgentFrameworkSection agentFramework={model.agentFramework} />

      <GrowthAiOsRevenueOperatorSection revenueOperator={model.revenueOperator} />

      <GrowthAiOsAgentEventsSection agentEvents={model.agentEvents} />

      <GrowthAiOsAgentMemorySection agentMemory={model.agentMemory} />

      <GrowthAiOsMissionsSection missionFramework={model.missionFramework} />

      <GrowthAiOsMissionPrioritiesSection missionPriority={model.missionPriority} />

      <GrowthAiOsSchedulerReadinessSection schedulerReadiness={model.schedulerReadiness} />

      <div id="autonomous-research-pilot">
        <GrowthAiOsAutonomousResearchPilotSection
          autonomousResearchPilot={model.autonomousResearchPilot}
        />
      </div>

      <GrowthAiOsOperationsSectionCard
        title="Executive Summary"
        description="Legacy command center executive rollup."
        icon={<Sparkles className="size-5 text-indigo-600" />}
        qaSection="executive-summary"
      >
        <div className="space-y-4">
          <p className="text-base font-medium text-foreground">{model.executiveSummary.headline}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <GrowthAiOsKpiCard label="Active missions" value={model.executiveSummary.activeMissionCount} />
            <GrowthAiOsKpiCard label="Pending Work Orders" value={model.executiveSummary.pendingWorkOrderCount} />
            <GrowthAiOsKpiCard label="Needs approval" value={model.executiveSummary.approvalRequiredCount} />
            <GrowthAiOsKpiCard label="Blocked / escalated" value={model.executiveSummary.blockedWorkOrderCount} />
          </div>
          {model.executiveSummary.primaryFocus ? (
            <p className="text-sm text-muted-foreground">
              Look first: <span className="font-medium text-foreground">{model.executiveSummary.primaryFocus}</span>
            </p>
          ) : null}
        </div>
      </GrowthAiOsOperationsSectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthAiOsOperationsSectionCard
          title="Active Missions"
          description="Running Growth objectives Alden is coordinating."
          icon={<Radar className="size-5 text-sky-600" />}
          qaSection="active-missions"
        >
          {model.activeMissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active missions.</p>
          ) : (
            <div className="space-y-3">
              {model.activeMissions.map((mission) => (
                <div key={mission.missionId} className="rounded-lg border border-border/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{mission.title}</p>
                    <Badge variant="outline">{mission.currentStageId ?? mission.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {mission.progressPercent}% progress · {mission.activeWorkOrderCount} active Work Order(s)
                  </p>
                  <Link
                    href={mission.planningReviewHref}
                    className="mt-2 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Mission Planning Review
                  </Link>
                </div>
              ))}
            </div>
          )}
        </GrowthAiOsOperationsSectionCard>

        <GrowthAiOsOperationsSectionCard
          title="Needs Attention"
          description="Approvals, blocks, and health signals."
          icon={<ShieldAlert className="size-5 text-amber-600" />}
          qaSection="needs-attention"
        >
          {model.needsAttention.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
          ) : (
            <div className="space-y-2">
              {model.needsAttention.map((item) => (
                <div key={item.id} className={cn("rounded-lg border p-3", severityTone(item.severity))}>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                  {item.href ? (
                    <Link href={item.href} className="mt-2 inline-flex text-sm font-medium text-indigo-600">
                      Open
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </GrowthAiOsOperationsSectionCard>
      </div>

      <GrowthAiOsOperationsSectionCard
        title="Recent AI OS Activity"
        description="Latest events across missions, Work Orders, and agents."
        icon={<Activity className="size-5 text-violet-600" />}
        qaSection="recent-activity"
      >
        {model.recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent AI OS events.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {model.recentActivity.map((item) => (
              <li key={item.eventId} className="rounded-md border border-border/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize">{item.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.occurredAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{item.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </GrowthAiOsOperationsSectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthAiOsOperationsSectionCard title="Executive Brain Activity" qaSection="executive-brain-activity">
          {model.executiveBrainActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent Executive Brain activity.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {model.executiveBrainActivity.slice(0, 8).map((item) => (
                <li key={item.eventId} className="rounded-md border border-border/60 px-3 py-2">
                  <p className="font-medium capitalize">{item.eventType.replaceAll(".", " ")}</p>
                  <p className="text-muted-foreground">{item.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </GrowthAiOsOperationsSectionCard>

        <GrowthAiOsOperationsSectionCard title="Work Order Queues" qaSection="work-order-queues" id="work-order-queues">
          <div className="space-y-4 text-sm">
            {[
              { label: "Pending", items: model.pendingWorkOrders },
              { label: "Needs approval / decision", items: model.approvalWorkOrders },
              { label: "Blocked / escalated", items: model.blockedWorkOrders },
            ].map((queue) => (
              <div key={queue.label}>
                <p className="font-medium">{queue.label}</p>
                {queue.items.length === 0 ? (
                  <p className="text-muted-foreground">None</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {queue.items.slice(0, 4).map((workOrder) => (
                      <li key={workOrder.workOrderId} className="text-muted-foreground">
                        {workOrder.workOrderType.replaceAll("_", " ")} · {workOrder.status}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </GrowthAiOsOperationsSectionCard>
      </div>

      <GrowthAiOsOperationsSectionCard title="Recent Decision Records" qaSection="recent-decisions">
        {model.recentDecisionRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent Decision Records.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {model.recentDecisionRecords.slice(0, 8).map((record) => (
              <li key={record.decisionRecordId} className="rounded-md border border-border/60 px-3 py-2">
                <p className="font-medium">{record.ownerAgent}</p>
                <p className="text-muted-foreground">{record.explanation}</p>
              </li>
            ))}
          </ul>
        )}
      </GrowthAiOsOperationsSectionCard>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <GrowthAiOsOperationsSectionCard title="Agent Health" icon={<Bot className="size-5" />} qaSection="agent-health">
          <div className="space-y-2 text-sm">
            <p>
              {model.agentHealth.agents.filter((agent) => agent.healthStatus === "healthy").length}/
              {model.agentHealth.agents.length} healthy
            </p>
            {model.agentHealth.agents.slice(0, 6).map((agent) => (
              <div key={agent.registrationId} className="flex justify-between gap-2 rounded-md border px-2 py-1.5">
                <span>{agent.agentKey}</span>
                <Badge variant={agent.stale ? "destructive" : "secondary"}>{agent.healthStatus}</Badge>
              </div>
            ))}
          </div>
        </GrowthAiOsOperationsSectionCard>

        <GrowthAiOsOperationsSectionCard title="Provider Health" icon={<Cpu className="size-5" />} qaSection="provider-health">
          <div className="space-y-2 text-sm">
            <Badge variant={model.providerHealth.ready ? "secondary" : "destructive"}>
              {model.providerHealth.ready ? "Ready" : "Degraded"}
            </Badge>
            {model.providerHealth.providers.map((provider) => (
              <div key={provider.providerId} className="flex justify-between gap-2 rounded-md border px-2 py-1.5">
                <span>{provider.providerId}</span>
                <Badge variant={provider.available ? "secondary" : "outline"}>
                  {provider.available ? "available" : "unavailable"}
                </Badge>
              </div>
            ))}
          </div>
        </GrowthAiOsOperationsSectionCard>

        <GrowthAiOsOperationsSectionCard title="Pilot Status" icon={<Flag className="size-5" />} qaSection="pilot-status">
          <div className="space-y-2 text-sm">
            <p>Lead Research Pilot: {model.pilotStatus.featureEnabled ? "enabled" : "disabled"}</p>
            <p>Active pilot missions: {model.pilotStatus.activePilotMissions}</p>
            {model.pilotStatus.recentLeadIds.map((leadId) => {
              const href = buildAiOsPilotLeadResearchHref(leadId)
              return href ? (
                <Link key={leadId} href={href} className="block text-indigo-600 hover:text-indigo-700">
                  Pilot observation · {leadId.slice(0, 8)}…
                </Link>
              ) : null
            })}
          </div>
        </GrowthAiOsOperationsSectionCard>
      </div>

      <GrowthAiOsOperationsSectionCard
        title="Safe Mode / Feature Flags"
        qaSection="safe-mode"
        description="Runtime guardrails — read-only visibility."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <GrowthAiOsKpiCard label="Autonomy enabled" value={model.safeMode.autonomyEnabled ? "Yes" : "No"} />
          <GrowthAiOsKpiCard label="Objective mode" value={model.safeMode.objectiveModeEnabled ? "On" : "Off"} />
          <GrowthAiOsKpiCard label="Emergency stop" value={model.safeMode.emergencyStopActive ? "Active" : "Off"} />
        </div>
      </GrowthAiOsOperationsSectionCard>
    </div>
  )
}
