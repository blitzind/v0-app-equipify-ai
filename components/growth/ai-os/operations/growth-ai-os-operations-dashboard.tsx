"use client"

import Link from "next/link"
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  ListOrdered,
  Settings2,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { GrowthAiOsKpiCard } from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-ux-utils"
import { GrowthAiOsDailyBriefingSection } from "@/components/growth/ai-os/command-center/growth-ai-os-daily-briefing-section"
import { GrowthAiOsOperationsSectionCard } from "@/components/growth/ai-os/operations/growth-ai-os-operations-section-card"
import type { AiOsOperationsDashboardReadModel } from "@/lib/growth/aios/ai-os-operations-dashboard-types"
import {
  GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER,
  type AiOsOperationsHealthStatus,
  type AiOsOperationsUrgencyLevel,
} from "@/lib/growth/aios/ai-os-operations-dashboard-types"
import { cn } from "@/lib/utils"

function healthTone(status: AiOsOperationsHealthStatus) {
  if (status === "healthy") return "border-emerald-200 bg-emerald-50/70 text-emerald-900"
  if (status === "degraded") return "border-amber-200 bg-amber-50/70 text-amber-900"
  return "border-rose-200 bg-rose-50/70 text-rose-900"
}

function urgencyVariant(urgency: AiOsOperationsUrgencyLevel) {
  if (urgency === "high") return "destructive" as const
  if (urgency === "medium") return "secondary" as const
  return "outline" as const
}

function categoryLabel(category: string) {
  return category.replaceAll("_", " ")
}

export function GrowthAiOsOperationsDashboard({
  dashboard,
}: {
  dashboard: AiOsOperationsDashboardReadModel
}) {
  const overview = dashboard.executiveOverview

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER}>
      <GrowthAiOsOperationsSectionCard
        title="Executive overview"
        description="What happened, what needs attention, and how AI is operating right now."
        icon={<Sparkles className="size-5 text-indigo-600" />}
        qaSection="operations-executive-overview"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
            <p className="text-base font-semibold text-foreground">{overview.dailyBriefingHeadline}</p>
            <p className="mt-1 text-sm text-muted-foreground">{overview.dailyBriefingSummary}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <GrowthAiOsKpiCard
              label="AI health"
              value={overview.aiHealthLabel}
              className={cn("border", healthTone(overview.aiHealthStatus))}
            />
            <GrowthAiOsKpiCard label="Active autonomous runs" value={overview.activeAutonomousRuns} />
            <GrowthAiOsKpiCard label="Needs attention" value={overview.needsAttentionCount} />
            <GrowthAiOsKpiCard label="Approval backlog" value={overview.approvalBacklogCount} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <GrowthAiOsKpiCard label="Priority work" value={overview.priorityWorkLabel ?? "—"} />
            <GrowthAiOsKpiCard label="Safe mode" value={overview.safeModeLabel} />
            <GrowthAiOsKpiCard label="Operating mode" value={overview.operatingModeLabel} />
            <GrowthAiOsKpiCard label="Mode control" value="Read-only" />
          </div>
        </div>
      </GrowthAiOsOperationsSectionCard>

      <GrowthAiOsOperationsSectionCard
        title="Autonomy state"
        description="Read-only policy summary — configure AI behavior in Growth Autonomy."
        icon={<Settings2 className="size-5 text-indigo-600" />}
        qaSection="operations-autonomy-state"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <GrowthAiOsKpiCard label="Operating mode" value={dashboard.autonomyState.operatingModeLabel} />
          <GrowthAiOsKpiCard
            label="Autonomy"
            value={dashboard.autonomyState.autonomyEnabled ? "Enabled" : "Disabled"}
          />
          <GrowthAiOsKpiCard
            label="Emergency stop"
            value={dashboard.autonomyState.emergencyStopActive ? "Active" : "Off"}
          />
          <GrowthAiOsKpiCard
            label="Shadow mode"
            value={dashboard.autonomyState.shadowModeEnabled ? "On" : "Off"}
          />
        </div>
        {dashboard.autonomyState.activeAutonomousAgents.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {dashboard.autonomyState.activeAutonomousAgents.map((agent) => (
              <Badge key={agent} variant="secondary" className="capitalize">
                {agent}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No autonomous agents active under current policy.</p>
        )}
        <Link
          href={dashboard.autonomyState.configureHref}
          className="mt-3 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Configure in Growth Autonomy
        </Link>
      </GrowthAiOsOperationsSectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthAiOsOperationsSectionCard
          title="Active work"
          description="Highest-value missions, plans in motion, and blocked items."
          icon={<Target className="size-5 text-sky-600" />}
          qaSection="operations-active-work"
        >
          {dashboard.activeWork.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active work items right now.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.activeWork.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.title}</p>
                    <Badge variant="outline" className="capitalize">
                      {categoryLabel(item.category)}
                    </Badge>
                  </div>
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

        <GrowthAiOsOperationsSectionCard
          title="Approval summary"
          description="Counts only — open the linked workflow to approve."
          icon={<ClipboardList className="size-5 text-violet-600" />}
          qaSection="operations-approval-summary"
        >
          <p className="mb-3 text-sm text-muted-foreground">
            {dashboard.approvalSummary.totalCount} item(s) waiting across approval queues.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {dashboard.approvalSummary.categories.map((category) => (
              <Link
                key={category.id}
                href={category.href}
                className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 transition hover:border-indigo-200 hover:bg-indigo-50/40"
              >
                <span className="text-sm font-medium">{category.label}</span>
                <Badge variant={category.count > 0 ? "destructive" : "secondary"}>{category.count}</Badge>
              </Link>
            ))}
          </div>
        </GrowthAiOsOperationsSectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthAiOsOperationsSectionCard
          title="Mission priorities"
          description="Top 10 business priorities — ranked for operator action."
          icon={<ListOrdered className="size-5 text-indigo-600" />}
          qaSection="operations-mission-priorities"
        >
          {dashboard.missionPriorities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ranked missions yet.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.missionPriorities.map((row) => (
                <div key={`${row.rank}-${row.missionLabel}`} className="rounded-lg border border-border/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      #{row.rank} · {row.missionLabel}
                    </p>
                    <Badge variant="outline">{row.priorityLabel}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Owner: {row.ownerAgent.replaceAll("_", " ")}</span>
                    <span>ROI: {row.roiLabel}</span>
                    <Badge variant={urgencyVariant(row.urgency)}>{row.urgency} urgency</Badge>
                  </div>
                  {row.blockers.length > 0 ? (
                    <p className="mt-2 text-sm text-amber-800">Blocker: {row.blockers[0]}</p>
                  ) : null}
                  {row.href ? (
                    <Link href={row.href} className="mt-2 inline-flex text-sm font-medium text-indigo-600">
                      Open mission
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </GrowthAiOsOperationsSectionCard>

        <GrowthAiOsOperationsSectionCard
          title="Active objectives"
          description="Growth objective progress and AI contribution."
          icon={<CheckCircle2 className="size-5 text-emerald-600" />}
          qaSection="operations-active-objectives"
        >
          {dashboard.activeObjectives.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active objectives.</p>
          ) : (
            <div className="space-y-2">
              {dashboard.activeObjectives.map((objective) => (
                <div
                  key={objective.objectiveId}
                  className={cn(
                    "rounded-lg border p-3",
                    objective.stalled ? "border-amber-200 bg-amber-50/50" : "border-border/70",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{objective.title}</p>
                    <Badge variant={objective.stalled ? "destructive" : "secondary"}>
                      {objective.progressPercent}%
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{objective.aiContributionLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Forecast: {objective.completionForecastLabel}
                    {objective.stalled ? " · Stalled" : ""}
                  </p>
                  <Link href={objective.href} className="mt-2 inline-flex text-sm font-medium text-indigo-600">
                    Mission Planning Review
                  </Link>
                </div>
              ))}
            </div>
          )}
        </GrowthAiOsOperationsSectionCard>
      </div>

      <GrowthAiOsOperationsSectionCard
        title="AI activity"
        description="Chronological stream across agents, runtime, research, and orchestration."
        icon={<Activity className="size-5 text-violet-600" />}
        qaSection="operations-ai-activity"
      >
        {dashboard.activityTimeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent AI activity.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {dashboard.activityTimeline.map((item) => (
              <li key={item.id} className="rounded-md border border-border/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize">{item.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.occurredAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{item.summary}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {item.source.replaceAll("_", " ")}
                  </Badge>
                  {item.href ? (
                    <Link href={item.href} className="text-xs font-medium text-indigo-600">
                      Details
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </GrowthAiOsOperationsSectionCard>

      <GrowthAiOsOperationsSectionCard
        title="AI health"
        description="Operator-level health summary — not engineering diagnostics."
        icon={<HeartPulse className="size-5 text-rose-600" />}
        qaSection="operations-ai-health"
      >
        <div className={cn("mb-4 rounded-lg border p-3 text-sm font-medium", healthTone(dashboard.healthSummary.overallStatus))}>
          Overall: {dashboard.healthSummary.overallStatus}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <GrowthAiOsKpiCard label="Agents" value={dashboard.healthSummary.agentHealthLabel} />
          <GrowthAiOsKpiCard label="Runtime" value={dashboard.healthSummary.runtimeHealthLabel} />
          <GrowthAiOsKpiCard label="Queues" value={dashboard.healthSummary.queueHealthLabel} />
          <GrowthAiOsKpiCard label="Scheduler" value={dashboard.healthSummary.schedulerReadinessLabel} />
          <GrowthAiOsKpiCard label="Budget usage" value={dashboard.healthSummary.budgetUsageLabel} />
          <GrowthAiOsKpiCard label="Safe mode" value={dashboard.healthSummary.safeModeLabel} />
          <GrowthAiOsKpiCard label="Blocked agents" value={dashboard.healthSummary.blockedAgentsCount} />
        </div>
      </GrowthAiOsOperationsSectionCard>

      <GrowthAiOsOperationsSectionCard
        title="Engineering diagnostics summary"
        description="Compact phase summaries — enable diagnostics below for full engineering sections."
        icon={<Wrench className="size-5 text-muted-foreground" />}
        qaSection="operations-engineering-diagnostics-summary"
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {dashboard.engineeringDiagnostics.map((diagnostic) => (
            <div key={diagnostic.id} className="rounded-lg border border-border/70 p-3">
              <p className="font-medium">{diagnostic.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{diagnostic.statusLabel}</p>
              <p className="text-xs text-muted-foreground">{diagnostic.detail}</p>
              {diagnostic.count != null ? (
                <Badge variant="outline" className="mt-2">
                  {diagnostic.count}
                </Badge>
              ) : null}
            </div>
          ))}
        </div>
      </GrowthAiOsOperationsSectionCard>

      <GrowthAiOsDailyBriefingSection briefing={dashboard.dailyBriefing} />
    </div>
  )
}
