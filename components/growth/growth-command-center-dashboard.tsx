"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Check,
  ListOrdered,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  SkipForward,
  Sparkles,
  Timer,
  Trophy,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthCommandCommunicationOpsSection } from "@/components/growth/growth-command-communication-ops-section"
import { GrowthCommandDogfoodCompactSection } from "@/components/growth/growth-command-dogfood-compact-section"
import { GrowthCommandLifecycleCompactSection } from "@/components/growth/growth-command-lifecycle-compact-section"
import { GrowthCommandResearchCoverageSection } from "@/components/growth/growth-command-research-coverage-section"
import { GrowthCommandMarketOperatingSection } from "@/components/growth/growth-command-market-operating-section"
import { GrowthCommandSignalIntelligenceSection } from "@/components/growth/growth-command-signal-intelligence-section"
import { GrowthCommandDealIntelligenceSection } from "@/components/growth/growth-command-deal-intelligence-section"
import { GrowthCommandCallIntelligenceSection } from "@/components/growth/growth-command-call-intelligence-section"
import { GrowthCommandHumanExecutionSection } from "@/components/growth/growth-command-human-execution-section"
import { GrowthCommandMeetingOutcomesSection } from "@/components/growth/growth-command-meeting-outcomes-section"
import {
  GrowthCommandMorningFocusMetrics,
  GrowthCommandPipelineMomentumBadge,
  GrowthCommandRevenueExecutionSection,
} from "@/components/growth/growth-command-revenue-execution-section"
import { GrowthCommandPipelineRevenueSection } from "@/components/growth/growth-command-pipeline-revenue-section"
import { GrowthCommandQuickActionsRail } from "@/components/growth/growth-command-quick-actions-rail"
import { GrowthCommandSectionTabs } from "@/components/growth/growth-command-section-tabs"
import { GrowthOperatorAttentionStrip } from "@/components/growth/growth-operator-attention-strip"
import { GrowthOperatorDailyWorkflow } from "@/components/growth/growth-operator-daily-workflow"
import { GROWTH_OPERATOR_UX_H3_QA_MARKER } from "@/lib/growth/operator-ux/operator-ux-h3-types"
import { useAdmin } from "@/lib/admin-store"
import { selectFocusSprintActions } from "@/lib/growth/command/command-action-engine"
import type {
  GrowthCommandAction,
  GrowthCommandBossBattleKind,
  GrowthCommandDashboard,
  GrowthCommandMomentumState,
} from "@/lib/growth/command/command-action-types"
import {
  commandActionImpactTone,
  displayCommandActionImpact,
  GROWTH_COMMAND_CENTER_SPACING_QA_MARKER,
} from "@/lib/growth/command/command-action-types"
import type { GrowthCadenceCommandSummary } from "@/lib/growth/cadence/cadence-types"
import type { GrowthHumanExecutionDashboard } from "@/lib/growth/human-execution/human-execution-types"
import type { MeetingOutcomeDashboardSummary } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"
import type { GrowthExecutionDashboard } from "@/lib/growth/execution/execution-priority-types"
import type { GrowthMeetingCommandSummary } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import { cn } from "@/lib/utils"

const SPRINT_SECONDS = 30 * 60
const DEFAULT_VISIBLE_ACTIONS = 5
const SECTION_SCROLL_CLASS = "scroll-mt-24"

function momentumTone(state: GrowthCommandMomentumState): "healthy" | "warning" | "attention" | "neutral" {
  if (state === "momentum_building") return "healthy"
  if (state === "execution_slipping") return "warning"
  if (state === "revenue_at_risk") return "attention"
  return "neutral"
}

function difficultyTone(difficulty: string): "healthy" | "attention" | "medium" | "critical" {
  if (difficulty === "easy") return "healthy"
  if (difficulty === "medium") return "medium"
  if (difficulty === "hard") return "attention"
  return "critical"
}

function greetingName(displayName?: string | null): string {
  const hour = new Date().getHours()
  const salutation = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  if (displayName?.trim()) return `${salutation}, ${displayName.split(" ")[0]}`
  return salutation
}

function heatBucketLabel(bucket: string): string {
  return bucket.replace(/_/g, " ")
}

function ActionCard({
  action,
  compact,
  showWhy = true,
}: {
  action: GrowthCommandAction
  compact?: boolean
  showWhy?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-background",
        compact ? "px-3 py-2" : "px-5 py-4",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-foreground">{action.companyName}</p>
          <p className="text-sm leading-snug text-foreground/90">{action.title}</p>
          {showWhy && !compact ? (
            <p className="pt-1 text-sm leading-relaxed text-muted-foreground">{action.why}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <GrowthBadge
              label={`Impact ${displayCommandActionImpact(action.impactScore)}`}
              tone={commandActionImpactTone(action.impactScore)}
            />
            <GrowthBadge label={`${action.effortMinutes} min`} tone="neutral" />
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0 self-center">
          <Link href={action.ctaHref}>{action.ctaLabel}</Link>
        </Button>
      </div>
    </div>
  )
}

export function GrowthCommandCenterDashboard() {
  const { sessionIdentity } = useAdmin()
  const [dashboard, setDashboard] = useState<GrowthCommandDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [battleFilter, setBattleFilter] = useState<GrowthCommandBossBattleKind | null>(null)
  const [showAllActions, setShowAllActions] = useState(false)
  const [sprintOpen, setSprintOpen] = useState(false)
  const [sprintFullscreen, setSprintFullscreen] = useState(false)
  const [sprintSecondsLeft, setSprintSecondsLeft] = useState(SPRINT_SECONDS)
  const [sprintRunning, setSprintRunning] = useState(false)
  const [sprintCompleted, setSprintCompleted] = useState<Set<string>>(new Set())
  const [sprintSkipped, setSprintSkipped] = useState<Set<string>>(new Set())
  const [meetingsToday, setMeetingsToday] = useState(0)
  const [callsDue, setCallsDue] = useState(0)
  const [executionDashboard, setExecutionDashboard] = useState<GrowthExecutionDashboard | null>(null)
  const [humanExecutionDashboard, setHumanExecutionDashboard] = useState<GrowthHumanExecutionDashboard | null>(null)
  const [meetingOutcomesDashboard, setMeetingOutcomesDashboard] = useState<MeetingOutcomeDashboardSummary | null>(null)
  const [startingSprint, setStartingSprint] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashboardRes, meetingsRes, cadenceRes, executionRes, humanExecutionRes, meetingOutcomesRes] =
        await Promise.all([
        fetch("/api/platform/growth/command/dashboard", { cache: "no-store" }),
        fetch("/api/platform/growth/meetings/command-summary", { cache: "no-store" }),
        fetch("/api/platform/growth/cadence/command-summary", { cache: "no-store" }),
        fetch("/api/platform/growth/execution/dashboard", { cache: "no-store" }),
        fetch("/api/platform/growth/human-execution/dashboard", { cache: "no-store" }),
        fetch("/api/platform/growth/meeting-outcomes/dashboard", { cache: "no-store" }),
      ])
      const data = (await dashboardRes.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthCommandDashboard
        message?: string
      }
      const meetingsData = (await meetingsRes.json().catch(() => ({}))) as {
        summary?: GrowthMeetingCommandSummary | null
      }
      const cadenceData = (await cadenceRes.json().catch(() => ({}))) as {
        summary?: GrowthCadenceCommandSummary | null
      }
      const executionData = (await executionRes.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthExecutionDashboard
      }
      const humanExecutionData = (await humanExecutionRes.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthHumanExecutionDashboard | null
      }
      const meetingOutcomesData = (await meetingOutcomesRes.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: MeetingOutcomeDashboardSummary | null
      }
      if (!dashboardRes.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load command dashboard.")
      }
      setDashboard(data.dashboard)
      setExecutionDashboard(executionData.ok && executionData.dashboard ? executionData.dashboard : null)
      setHumanExecutionDashboard(
        humanExecutionData.ok && humanExecutionData.dashboard ? humanExecutionData.dashboard : null,
      )
      setMeetingOutcomesDashboard(
        meetingOutcomesData.ok && meetingOutcomesData.dashboard ? meetingOutcomesData.dashboard : null,
      )
      setMeetingsToday(meetingsData.summary?.meetingsTodayCount ?? 0)
      setCallsDue(cadenceData.summary?.callTasksDueCount ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!sprintRunning) return
    const timer = window.setInterval(() => {
      setSprintSecondsLeft((prev) => {
        if (prev <= 1) {
          setSprintRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [sprintRunning])

  const sprintActions = useMemo(
    () => (dashboard ? selectFocusSprintActions(dashboard.actions) : []),
    [dashboard],
  )

  const filteredActions = useMemo(() => {
    if (!dashboard) return []
    if (!battleFilter) return dashboard.actions
    return dashboard.actions.filter((action) => action.bossBattle === battleFilter)
  }, [dashboard, battleFilter])

  const visibleActions = showAllActions ? filteredActions : filteredActions.slice(0, DEFAULT_VISIBLE_ACTIONS)
  const hiddenActionCount = Math.max(0, filteredActions.length - DEFAULT_VISIBLE_ACTIONS)

  function startSprint() {
    setSprintOpen(true)
    setSprintSecondsLeft(SPRINT_SECONDS)
    setSprintRunning(true)
    setSprintCompleted(new Set())
    setSprintSkipped(new Set())
  }

  function formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }

  async function startExecutionSprint(sprintType: string, durationMinutes: number) {
    setStartingSprint(true)
    try {
      const res = await fetch("/api/platform/growth/execution/sprints/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sprintType, durationMinutes }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Could not start sprint.")
      }
      await load()
      startSprint()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sprint start failed.")
    } finally {
      setStartingSprint(false)
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading command center…
      </div>
    )
  }

  if (error && !dashboard) {
    return <p className="text-sm text-rose-600">{error}</p>
  }

  if (!dashboard) return null

  const mission = dashboard.missionControl
  const topFocus =
    executionDashboard?.morningFocus.topRevenuePriorities[0] ??
    dashboard.topWinOpportunity ??
    sprintActions[0] ??
    filteredActions[0] ??
    null

  const sprintPanel = sprintOpen ? (
    <div
      className={cn(
        "rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-sm sm:p-5",
        sprintFullscreen && "fixed inset-4 z-50 overflow-y-auto bg-background",
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Timer className="size-4 text-indigo-700" />
          <div>
            <h2 className="text-base font-semibold">Focus Sprint</h2>
            <p className="text-sm text-muted-foreground">30 minutes · 5 prioritized actions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-background px-3 py-1.5 font-mono text-lg font-bold tabular-nums">
            {formatTimer(sprintSecondsLeft)}
          </span>
          <Button type="button" variant="outline" size="icon" onClick={() => setSprintFullscreen((v) => !v)}>
            {sprintFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSprintOpen(false)
              setSprintRunning(false)
              setSprintFullscreen(false)
            }}
          >
            Exit
          </Button>
        </div>
      </div>
      <ul className="space-y-2">
        {sprintActions.map((action, index) => {
          const done = sprintCompleted.has(action.id)
          const skipped = sprintSkipped.has(action.id)
          return (
            <li
              key={action.id}
              className={cn(
                "rounded-lg border px-3 py-2",
                done ? "border-emerald-200 bg-emerald-50/50" : skipped ? "opacity-60" : "border-border bg-background",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action {index + 1}</p>
                  <p className="text-sm font-medium">{action.companyName}</p>
                  <p className="text-sm">{action.title}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={done || skipped}
                    onClick={() => setSprintSkipped((prev) => new Set(prev).add(action.id))}
                  >
                    <SkipForward className="mr-1 size-3.5" />
                    Skip
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={done || skipped}
                    onClick={() => setSprintCompleted((prev) => new Set(prev).add(action.id))}
                  >
                    <Check className="mr-1 size-3.5" />
                    Done
                  </Button>
                  <Button asChild size="sm" disabled={skipped}>
                    <Link href={action.ctaHref}>{action.ctaLabel}</Link>
                  </Button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  ) : null

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_COMMAND_CENTER_SPACING_QA_MARKER} data-h3-qa={GROWTH_OPERATOR_UX_H3_QA_MARKER}>
      {sprintPanel}

      <GrowthOperatorAttentionStrip />
      <GrowthOperatorDailyWorkflow />

      <GrowthCommandSectionTabs />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="space-y-6">
          <div id="cc-today" className={cn(SECTION_SCROLL_CLASS, "space-y-6")}>
          <GrowthEngineCard className="overflow-hidden border-0 p-0 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-200/70 dark:shadow-indigo-950/30 dark:ring-indigo-500/25">
            <div className="bg-gradient-to-br from-indigo-50/95 via-white to-slate-50/60 p-6 sm:p-7 dark:from-indigo-950/55 dark:via-slate-900 dark:to-slate-950/90">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-xl font-semibold tracking-tight sm:text-2xl">
                    {greetingName(sessionIdentity?.displayName)}
                  </p>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {topFocus
                      ? `Top focus: ${topFocus.companyName} — ${topFocus.title}`
                      : "Review your ranked queue and start a focus sprint."}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {executionDashboard ? (
                      <GrowthCommandPipelineMomentumBadge
                        momentum={executionDashboard.morningFocus.pipelineMomentum}
                        label={executionDashboard.morningFocus.pipelineMomentumLabel}
                      />
                    ) : (
                      <GrowthBadge label={mission.momentumLabel} tone={momentumTone(mission.momentumState)} />
                    )}
                    <GrowthBadge label={`${dashboard.operatorRankLabel} · ${dashboard.operatorScore} pts`} tone="neutral" />
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
                  <Button type="button" onClick={startSprint} className="gap-2 shadow-sm">
                    <Zap className="size-4" />
                    Start 30 Minute Sprint
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void load()} disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Refresh
                  </Button>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-indigo-100/80 pt-6 dark:border-indigo-500/20 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6">
                {executionDashboard ? (
                  <GrowthCommandMorningFocusMetrics dashboard={executionDashboard} />
                ) : (
                  <>
                    <StatTile label="Critical actions" value={mission.criticalActions} className="bg-background/80 p-3.5" />
                    <StatTile label="Revenue at risk" value={mission.revenueAtRisk} className="bg-background/80 p-3.5" />
                    <StatTile label="Approvals waiting" value={mission.approvalsWaiting} className="bg-background/80 p-3.5" />
                    <StatTile label="Meetings today" value={meetingsToday} className="bg-background/80 p-3.5" />
                    <StatTile label="Calls due" value={callsDue} className="bg-background/80 p-3.5" />
                    <StatTile label="Stalled" value={mission.stalledOpportunities} className="bg-background/80 p-3.5" />
                  </>
                )}
              </div>
            </div>
          </GrowthEngineCard>

          <GrowthCommandQuickActionsRail variant="chips" />

          <GrowthEngineCard
            title="Ranked Action Queue"
            icon={<ListOrdered className="size-4" />}
            className="p-6 shadow-sm sm:p-6 [&>div:first-child]:mb-5"
          >
            {battleFilter ? (
              <p className="mb-5 text-sm text-muted-foreground">
                Filtered: <span className="font-medium capitalize">{battleFilter.replace(/_/g, " ")}</span>
                <Button type="button" variant="link" className="h-auto px-2" onClick={() => setBattleFilter(null)}>
                  Clear
                </Button>
              </p>
            ) : null}
            {filteredActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Queue is clear — no ranked actions right now.</p>
            ) : (
              <>
                <ul className="space-y-3">
                  {visibleActions.map((action) => (
                    <li key={action.id} className="border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
                      <ActionCard action={action} />
                    </li>
                  ))}
                </ul>
                {!showAllActions && hiddenActionCount > 0 ? (
                  <Button type="button" variant="outline" size="sm" className="mt-5" onClick={() => setShowAllActions(true)}>
                    Show {hiddenActionCount} more
                  </Button>
                ) : null}
                {showAllActions && filteredActions.length > DEFAULT_VISIBLE_ACTIONS ? (
                  <Button type="button" variant="ghost" size="sm" className="mt-5" onClick={() => setShowAllActions(false)}>
                    Show less
                  </Button>
                ) : null}
              </>
            )}
          </GrowthEngineCard>
          </div>

          {/* 3. Communication Operations */}
          <div id="cc-communication" className={SECTION_SCROLL_CLASS}>
          <GrowthCommandCommunicationOpsSection />
          </div>

          {/* 4. Pipeline + Revenue */}
          <div id="cc-revenue" className={SECTION_SCROLL_CLASS}>
          {executionDashboard ? (
            <GrowthCommandRevenueExecutionSection
              dashboard={executionDashboard}
              onStartSprint={(sprintType, durationMinutes) => void startExecutionSprint(sprintType, durationMinutes)}
              startingSprint={startingSprint}
            />
          ) : null}
          {humanExecutionDashboard ? (
            <div className="mt-6">
              <GrowthCommandHumanExecutionSection dashboard={humanExecutionDashboard} />
            </div>
          ) : null}
          {meetingOutcomesDashboard ? (
            <div className="mt-6">
              <GrowthCommandMeetingOutcomesSection dashboard={meetingOutcomesDashboard} />
            </div>
          ) : null}
          <GrowthCommandPipelineRevenueSection atRiskActions={dashboard.revenueRescueQueue} />
          </div>

          {/* 5. Research Coverage */}
          <div id="cc-research" className={SECTION_SCROLL_CLASS}>
          <GrowthCommandMarketOperatingSection marketHealth={dashboard.marketHealth} />
          <GrowthCommandSignalIntelligenceSection summary={dashboard.signalIntelligence} />
          <GrowthCommandResearchCoverageSection coverage={dashboard.researchCoverage} />
          <GrowthCommandDealIntelligenceSection summary={dashboard.dealIntelligence} />
          <GrowthCommandCallIntelligenceSection summary={dashboard.callIntelligence} />
          </div>

          {/* 6. Customer Lifecycle */}
          <div id="cc-lifecycle" className={SECTION_SCROLL_CLASS}>
          <GrowthCommandLifecycleCompactSection />
          </div>

          {/* 7. Dogfood Readiness */}
          <div id="cc-readiness" className={SECTION_SCROLL_CLASS}>
          <GrowthCommandDogfoodCompactSection />
          </div>

          {/* 8. Performance */}
          <div id="cc-performance" className={SECTION_SCROLL_CLASS}>
          <GrowthEngineCard title="Performance & End of Day" icon={<Trophy className="size-4" />}>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Boss Battles</p>
                {dashboard.bossBattles.every((b) => b.actionsRequired === 0) ? (
                  <p className="text-sm text-muted-foreground">No active boss battles.</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {dashboard.bossBattles.map((battle) => (
                      <div
                        key={battle.kind}
                        className="min-w-[180px] shrink-0 rounded-lg border border-border bg-background px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{battle.title}</p>
                          <GrowthBadge label={battle.difficulty} tone={difficultyTone(battle.difficulty)} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {battle.actionsRequired} actions · {battle.effortMinutes} min
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant={battleFilter === battle.kind ? "default" : "outline"}
                          className="mt-2 w-full"
                          disabled={battle.actionsRequired === 0}
                          onClick={() => setBattleFilter(battle.kind)}
                        >
                          Enter
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Operator rank</p>
                  <p className="text-lg font-semibold">{dashboard.operatorRankLabel}</p>
                  <p className="text-xs text-muted-foreground">{dashboard.operatorScore} pts today</p>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Win feed</p>
                  {dashboard.winFeed.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No wins yet today.</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm">
                      {dashboard.winFeed.slice(0, 2).map((win) => (
                        <li key={win.id}>
                          {win.companyName}: {win.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-lg border border-border px-3 py-2 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">End-of-day debrief</p>
                  <p className="mt-1 text-sm">
                    {dashboard.debrief.actionsCompleted} actions · impact {dashboard.debrief.impactScore} · pipeline protected{" "}
                    {dashboard.debrief.pipelineProtected}
                  </p>
                </div>
              </div>

              {dashboard.heatMap.some((b) => b.count > 0) ? (
                <div>
                  <p className="mb-2 text-sm font-medium">Opportunity heat map</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {dashboard.heatMap.map((bucket) => (
                      <div key={bucket.bucket} className="rounded-lg border border-border px-3 py-2 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wide">{heatBucketLabel(bucket.bucket)}</p>
                        <p className="text-xl font-bold tabular-nums">{bucket.count}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Heat map is empty.</p>
              )}

              {dashboard.coachTips.length > 0 ? (
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="size-4 text-muted-foreground" />
                    Coach tips
                  </p>
                  <ul className="space-y-1">
                    {dashboard.coachTips.slice(0, 2).map((tip) => (
                      <li key={tip.id} className="text-sm text-muted-foreground">
                        {tip.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </GrowthEngineCard>
          </div>
        </div>

        <div className="hidden xl:block">
          <GrowthCommandQuickActionsRail variant="rail" />
        </div>
      </div>
    </div>
  )
}
