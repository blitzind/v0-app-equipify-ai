"use client"

import Link from "next/link"
import { useMemo } from "react"
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  PauseCircle,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { buildGrowthSalesOperationsCenterViewModel } from "@/lib/growth/operations-center/build-growth-sales-operations-center-view-model"
import {
  GROWTH_SALES_OPERATIONS_CENTER_19A_QA_MARKER,
  GROWTH_SALES_OPERATIONS_CENTER_ROUTE,
  type GrowthSalesOperationsCenterViewModel,
} from "@/lib/growth/operations-center/growth-sales-operations-center-types"
import {
  GROWTH_CUSTOMER_EMPTY_OPERATIONS_COMPLETED,
  GROWTH_CUSTOMER_EMPTY_OPERATIONS_DECISION,
  GROWTH_CUSTOMER_EMPTY_OPERATIONS_FOCUS,
  GROWTH_CUSTOMER_EMPTY_OPERATIONS_NEXT,
  GROWTH_CUSTOMER_EMPTY_OPERATIONS_TIMELINE,
} from "@/lib/growth/customer-experience/growth-zero-assistance-adoption-19c-4a"
import { GROWTH_TRAINING_WORKSPACE_ROUTE } from "@/lib/growth/training/growth-training-workspace-types"
import { GROWTH_AVA_ABOUT_WORKSPACE_ROUTE } from "@/lib/growth/ava-about/growth-ava-about-workspace-types"
import { buildRelationshipLeadSnapshotsFromResearchLoop, mergeRelationshipLeadSnapshotMaps } from "@/lib/growth/relationship/project-relationship-graph-enrichment"
import { readAvaNarrativeMetricsSnapshot } from "@/lib/growth/ava-home/narrative"
import { readOperatingRhythmMemory } from "@/lib/growth/operating-rhythm/bridges/memory-bridge"
import { resolvePersistedOrganizationalMemoryStore } from "@/lib/growth/memory/storage/organization-memory-store"
import { normalizeGrowthHomeAiOsUxViewModel } from "@/lib/growth/home/growth-home-runtime-safe-defaults"
import {
  buildTeammateHandlingRows,
  GROWTH_HOME_SINGLE_AI_IDENTITY_19C_2A_QA_MARKER,
  GROWTH_HOME_TEAMMATE_CAPABILITIES_SECTION_TITLE,
} from "@/lib/growth/home/growth-home-runtime-presenter"
import { synthesizeGrowthHomeExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { buildAvaHomeHero } from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { useAdmin } from "@/lib/admin-store"
import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import { Skeleton } from "@/components/ui/skeleton"

type Props = {
  dashboard: GrowthWorkspaceDashboardViewModel
  workspaceSummary: GrowthHomeWorkspaceSummaryPayload
}

function SectionCard({
  title,
  subtitle,
  children,
  className,
  qaSection,
}: {
  title: string
  subtitle?: string | null
  children: React.ReactNode
  className?: string
  qaSection: string
}) {
  return (
    <section
      data-qa-section={qaSection}
      className={cn("rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm", className)}
    >
      <div className="mb-4 space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

function metricValueFromDashboard(
  dashboard: GrowthWorkspaceDashboardViewModel,
  sectionId: string,
  label: string,
): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

function buildEngineWorkspaceSummary(
  payload: GrowthHomeWorkspaceSummaryPayload,
): Pick<
  GrowthHomeWorkspaceSummaryPayload,
  "kpis" | "meetings" | "inbox" | "operatorTasks" | "avaConsole" | "dashboard" | "relationshipSnapshots" | "leadPool" | "missionDiscovery"
> {
  return {
    kpis: payload.kpis,
    meetings: payload.meetings,
    inbox: payload.inbox,
    operatorTasks: payload.operatorTasks,
    avaConsole: payload.avaConsole,
    dashboard: payload.dashboard,
    relationshipSnapshots: payload.relationshipSnapshots,
    leadPool: payload.leadPool,
    missionDiscovery: payload.missionDiscovery ?? null,
  }
}

function OperationsCenterBody({ model }: { model: GrowthSalesOperationsCenterViewModel }) {
  const handlingRows = buildTeammateHandlingRows(model.specialistTeam)

  return (
    <div
      data-qa-marker-19a={GROWTH_SALES_OPERATIONS_CENTER_19A_QA_MARKER}
      data-qa-marker-19c-2a={GROWTH_HOME_SINGLE_AI_IDENTITY_19C_2A_QA_MARKER}
      className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
    >
      <div className="space-y-5">
        <SectionCard
          title="Current focus"
          subtitle={model.executiveSummaryLine}
          qaSection="operations-current-focus"
        >
          {model.focus ? (
            <div className="space-y-3 rounded-xl border border-indigo-200/70 bg-indigo-50/40 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
              <div className="flex items-start gap-3">
                <Bot className="mt-0.5 size-5 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
                <div className="min-w-0 space-y-2">
                  <p className="text-lg font-semibold text-foreground">{model.focus.title}</p>
                  {model.focus.remainingLabel ? (
                    <p className="text-sm text-muted-foreground">{model.focus.remainingLabel}</p>
                  ) : null}
                  {model.focus.estimatedCompletionMinutes != null ? (
                    <p className="text-sm text-muted-foreground">
                      Estimated completion: {model.focus.estimatedCompletionMinutes} minutes
                    </p>
                  ) : null}
                  {model.focus.reason ? (
                    <p className="text-sm text-foreground">
                      <span className="font-medium">Reason:</span> {model.focus.reason}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{GROWTH_CUSTOMER_EMPTY_OPERATIONS_FOCUS}</p>
          )}
        </SectionCard>

        <SectionCard title="Why I chose this" qaSection="operations-decision-reasoning">
          {model.decisionExplanation ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-foreground">{model.decisionExplanation.headline}</p>
              {model.decisionExplanation.supportingReasons.length > 0 ? (
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {model.decisionExplanation.supportingReasons.map((reason) => (
                    <li key={reason} className="flex gap-2">
                      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-indigo-500" aria-hidden />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {GROWTH_CUSTOMER_EMPTY_OPERATIONS_DECISION}{" "}
              <Link href={GROWTH_TRAINING_WORKSPACE_ROUTE} className="font-medium text-indigo-700 hover:underline dark:text-indigo-300">
                Open Training
              </Link>
              .
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Want better decisions?{" "}
            <Link href={GROWTH_TRAINING_WORKSPACE_ROUTE} className="font-medium text-indigo-700 hover:underline dark:text-indigo-300">
              Teach me in Training
            </Link>
            .{" "}
            <Link href={GROWTH_AVA_ABOUT_WORKSPACE_ROUTE} className="font-medium text-indigo-700 hover:underline dark:text-indigo-300">
              About Your AI
            </Link>
            .
          </p>
        </SectionCard>

        <SectionCard title="Current queue" qaSection="operations-current-queue">
          <div className="grid gap-3 sm:grid-cols-2">
            {model.queueBuckets.map((bucket) => (
              <div key={bucket.id} className="rounded-xl border border-border/60 px-4 py-3">
                <p className="text-sm font-medium text-foreground">{bucket.label}</p>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    <dt>Queued</dt>
                    <dd className="text-base font-semibold text-foreground">{bucket.queued}</dd>
                  </div>
                  <div>
                    <dt>Active</dt>
                    <dd className="text-base font-semibold text-foreground">{bucket.active}</dd>
                  </div>
                  <div>
                    <dt>Done today</dt>
                    <dd className="text-base font-semibold text-foreground">{bucket.completedToday}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="What's next" qaSection="operations-working-next">
          {model.workingNextLines.length > 0 ? (
            <ul className="space-y-2 text-sm text-foreground">
              {model.workingNextLines.map((line) => (
                <li key={line} className="flex gap-2">
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{GROWTH_CUSTOMER_EMPTY_OPERATIONS_NEXT}</p>
          )}
        </SectionCard>
      </div>

      <div className="space-y-5">
        <SectionCard title="Recently completed" qaSection="operations-recently-completed">
          {model.recentlyCompleted.length > 0 ? (
            <ul className="space-y-2">
              {model.recentlyCompleted.map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{GROWTH_CUSTOMER_EMPTY_OPERATIONS_COMPLETED}</p>
          )}
        </SectionCard>

        <SectionCard title="Waiting" qaSection="operations-waiting">
          {model.waitingItems.length > 0 ? (
            <ul className="space-y-2">
              {model.waitingItems.map((item) => (
                <li key={item.id} className="rounded-lg border border-border/50 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <PauseCircle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                    <div className="min-w-0">
                      {item.href ? (
                        <Link href={item.href} className="text-sm font-medium hover:text-primary hover:underline">
                          {item.label}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                      )}
                      {item.detail ? <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing is blocking me right now.</p>
          )}
        </SectionCard>

        {model.confidence.length > 0 ? (
          <SectionCard title="Confidence" qaSection="operations-confidence">
            <ul className="space-y-3">
              {model.confidence.map((row) => (
                <li key={row.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{row.label}</span>
                    <span className="text-muted-foreground">{row.percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, row.percent))}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}

        <SectionCard title="Live timeline" qaSection="operations-live-timeline">
          {model.timeline.length > 0 ? (
            <ul className="space-y-3">
              {model.timeline.map((entry) => (
                <li key={entry.id} className="flex gap-3 text-sm">
                  <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">{entry.timeLabel}</span>
                  <span className="text-foreground">{entry.summary}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{GROWTH_CUSTOMER_EMPTY_OPERATIONS_TIMELINE}</p>
          )}
        </SectionCard>

        <SectionCard title={GROWTH_HOME_TEAMMATE_CAPABILITIES_SECTION_TITLE} qaSection="operations-teammate-capabilities">
          <ul className="space-y-2">
            {handlingRows.map((row) => (
              <li key={row.id} className="rounded-lg border border-border/60 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{row.capabilityLabel}</p>
                    <p className="text-xs text-muted-foreground">{row.statusLabel}</p>
                  </div>
                  {row.activeCount > 0 && !row.comingSoon ? (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                      {row.activeCount} active
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}

export function GrowthSalesOperationsCenterDashboard({ dashboard, workspaceSummary }: Props) {
  const { teammate } = useAiTeammateIdentity()
  const { sessionIdentity } = useAdmin()
  const operatorDisplayName = sessionIdentity?.displayName ?? null

  const model = useMemo(() => {
    const briefing = synthesizeGrowthHomeExecutiveBriefing({
      dashboard,
      recentViews: [],
      continueItems: [],
      teammate,
      operatorDisplayName,
    })
    const aiOsUx = normalizeGrowthHomeAiOsUxViewModel(briefing.aiOsUx)
    const engineWorkspaceSummary = buildEngineWorkspaceSummary(workspaceSummary)
    const researchSnapshots = buildRelationshipLeadSnapshotsFromResearchLoop(
      workspaceSummary.avaConsole?.researchLoopSummary ?? null,
    )
    const leadSnapshotsById = mergeRelationshipLeadSnapshotMaps(
      researchSnapshots,
      workspaceSummary.relationshipSnapshots?.byLeadId ?? {},
    )
    const hero = buildAvaHomeHero({
      greeting: aiOsUx.hero.greeting,
      hour: new Date().getHours(),
      employeeStatus: briefing.employeeStatus,
      aiOsUx,
      researchLoopSummary: workspaceSummary.avaConsole?.researchLoopSummary ?? null,
      accomplishments: briefing.accomplishments,
      repliesWaiting: metricValueFromDashboard(dashboard, "my-queue", "Inbox requiring replies"),
      workspaceSummary: engineWorkspaceSummary,
      waitingOnYou: aiOsUx.waitingOnYou,
      dailyWorkQueue: aiOsUx.dailyWorkQueue,
      timeline: briefing.timeline,
      previousSnapshot: readAvaNarrativeMetricsSnapshot(),
      operatingRhythmMemory: readOperatingRhythmMemory(),
      persistedMemoryStore: resolvePersistedOrganizationalMemoryStore({
        serverMemory: workspaceSummary.organizationalMemory ?? null,
      }),
      generatedAt: workspaceSummary.generatedAt,
      salesOutcomes: workspaceSummary.salesOutcomes ?? null,
      organizationalKnowledge: workspaceSummary.organizationalKnowledge?.store.items ?? null,
      operatorDisplayName,
      relationshipSnapshotsById: leadSnapshotsById,
    })

    const dailyBriefing = hero.dailyBriefing
    if (!dailyBriefing) return null

    return buildGrowthSalesOperationsCenterViewModel({
      dailyBriefing,
      decisionContext: {
        workspaceSummary: engineWorkspaceSummary,
        waitingOnYou: aiOsUx.waitingOnYou,
        dailyWorkQueue: aiOsUx.dailyWorkQueue,
        accomplishments: briefing.accomplishments,
        timeline: briefing.timeline,
        leadSnapshotsById,
      },
      missionDiscovery: workspaceSummary.missionDiscovery ?? null,
      mailboxWarnings: dashboard.briefing?.mailbox.warnings ?? 0,
      generatedAt: workspaceSummary.generatedAt,
    })
  }, [dashboard, workspaceSummary, teammate, operatorDisplayName])

  if (!model) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  return <OperationsCenterBody model={model} />
}

export { GROWTH_SALES_OPERATIONS_CENTER_ROUTE }
