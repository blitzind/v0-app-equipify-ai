"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Activity, Bot, Cpu, Flag, Radar, ShieldAlert, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GrowthAiOsKpiCard } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-ux-utils"
import { GrowthAiOsDailyBriefingSection } from "@/components/growth/ai-os/command-center/growth-ai-os-daily-briefing-section"
import { GrowthAiOsGrowthLeadResearchWorkflowSection } from "@/components/growth/ai-os/command-center/growth-ai-os-growth-lead-research-workflow-section"
import { GrowthAiOsExecutionPlanReviewSection } from "@/components/growth/ai-os/command-center/growth-ai-os-execution-plan-review-section"
import { GrowthAiOsApprovedPlanReadinessSection } from "@/components/growth/ai-os/command-center/growth-ai-os-approved-plan-readiness-section"
import { GrowthAiOsFutureExecutionHandoffSection } from "@/components/growth/ai-os/command-center/growth-ai-os-future-execution-handoff-section"
import { GrowthAiOsExecutionBoundaryAuditSection } from "@/components/growth/ai-os/command-center/growth-ai-os-execution-boundary-audit-section"
import { GrowthAiOsExecutionPreflightChecklistSection } from "@/components/growth/ai-os/command-center/growth-ai-os-execution-preflight-checklist-section"
import { GrowthAiOsExecutionSimulationSection } from "@/components/growth/ai-os/command-center/growth-ai-os-execution-simulation-section"
import { GrowthAiOsExecutionRuntimeSection } from "@/components/growth/ai-os/command-center/growth-ai-os-execution-runtime-section"
import type { AiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-types"
import { GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER } from "@/lib/growth/aios/ai-os-command-center-types"
import { buildAiOsPilotLeadResearchHref } from "@/lib/growth/aios/ai-os-public-routes"
import { cn } from "@/lib/utils"

type ApiResponse = {
  ok?: boolean
  commandCenter?: AiOsCommandCenterReadModel
  message?: string
  error?: string
}

function severityTone(severity: "high" | "medium" | "low") {
  if (severity === "high") return "border-rose-200 bg-rose-50/70"
  if (severity === "medium") return "border-amber-200 bg-amber-50/70"
  return "border-border bg-muted/20"
}

function SectionCard({
  title,
  description,
  icon,
  qaSection,
  children,
  className,
}: {
  title: string
  description?: string
  icon?: React.ReactNode
  qaSection: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className} data-qa-section={qaSection}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function GrowthAiOsCommandCenterPanel() {
  const [model, setModel] = useState<AiOsCommandCenterReadModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch("/api/platform/growth/ai-os/command-center", { cache: "no-store" })
    const body = (await response.json()) as ApiResponse
    if (!response.ok || !body.ok || !body.commandCenter) {
      throw new Error(body.message ?? body.error ?? "Could not load AI OS Command Center.")
    }
    setModel(body.commandCenter)
  }, [])

  useEffect(() => {
    void load()
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load AI OS Command Center.")
      })
      .finally(() => setLoading(false))
  }, [load])

  if (loading && !model) {
    return <p className="text-sm text-muted-foreground">Loading AI OS Command Center…</p>
  }

  if (error && !model) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!model) return null

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER}>
      <GrowthAiOsDailyBriefingSection briefing={model.dailyBriefing} />

      <GrowthAiOsGrowthLeadResearchWorkflowSection workflow={model.growthLeadResearchWorkflow} />

      <GrowthAiOsExecutionPlanReviewSection queue={model.executionPlanReviewQueue} onQueueUpdated={load} />

      <GrowthAiOsApprovedPlanReadinessSection approvedPlans={model.approvedPlanReadinessQueue} />

      <GrowthAiOsFutureExecutionHandoffSection handoffContracts={model.futureExecutionHandoffContracts} />

      <GrowthAiOsExecutionBoundaryAuditSection audit={model.executionBoundaryAudit} />

      <GrowthAiOsExecutionPreflightChecklistSection preflight={model.executionPreflightChecklist} />

      <GrowthAiOsExecutionSimulationSection simulation={model.executionSimulation} />
      <GrowthAiOsExecutionRuntimeSection executionRuntime={model.executionRuntime} onRefresh={() => void load()} />

      <SectionCard
        title=" Executive Summary"
        description="What Alden is working on and what needs you first."
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
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
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
        </SectionCard>

        <SectionCard
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
        </SectionCard>
      </div>

      <SectionCard
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
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title=" Executive Brain Activity"
          description="Recent Executive Brain events and runtime signals."
          qaSection="executive-brain-activity"
        >
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
        </SectionCard>

        <SectionCard title="Work Order Queues" qaSection="work-order-queues">
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
        </SectionCard>
      </div>

      <SectionCard title="Recent Decision Records" qaSection="recent-decisions">
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
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <SectionCard title="Agent Health" icon={<Bot className="size-5" />} qaSection="agent-health">
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
        </SectionCard>

        <SectionCard title="Provider Health" icon={<Cpu className="size-5" />} qaSection="provider-health">
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
        </SectionCard>

        <SectionCard title="Pilot Status" icon={<Flag className="size-5" />} qaSection="pilot-status">
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
        </SectionCard>
      </div>

      <SectionCard
        title="Safe Mode / Feature Flags"
        qaSection="safe-mode"
        description="Runtime guardrails — read-only visibility."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <GrowthAiOsKpiCard
            label="Autonomy enabled"
            value={model.safeMode.autonomyEnabled ? "Yes" : "No"}
          />
          <GrowthAiOsKpiCard
            label="Objective mode"
            value={model.safeMode.objectiveModeEnabled ? "On" : "Off"}
          />
          <GrowthAiOsKpiCard
            label="Emergency stop"
            value={model.safeMode.emergencyStopActive ? "Active" : "Off"}
          />
        </div>
      </SectionCard>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/growth/objectives" className="font-medium text-indigo-600 hover:text-indigo-700">
          Growth objectives
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">
        Read-only Command Center · generated {new Date(model.generatedAt).toLocaleString()}
      </p>
    </div>
  )
}
