"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Check,
  ChevronRight,
  Flame,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  SkipForward,
  Sparkles,
  Swords,
  Target,
  Timer,
  Trophy,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { selectFocusSprintActions } from "@/lib/growth/command/command-action-engine"
import type {
  GrowthCommandAction,
  GrowthCommandBossBattleKind,
  GrowthCommandDashboard,
  GrowthCommandMomentumState,
} from "@/lib/growth/command/command-action-types"
import { cn } from "@/lib/utils"

const SPRINT_SECONDS = 30 * 60

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

function heatBucketLabel(bucket: string): string {
  return bucket.replace(/_/g, " ")
}

function PipelineRing({
  label,
  current,
  target,
}: {
  label: string
  current: number
  target: number
}) {
  const pct = Math.min(100, Math.round((current / Math.max(target, 1)) * 100))
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-4">
      <div className="relative size-24">
        <svg className="size-full -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-indigo-600 transition-all"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold tabular-nums">{current}</span>
          <span className="text-[10px] text-muted-foreground">/ {target}</span>
        </div>
      </div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{pct}% of daily target</p>
    </div>
  )
}

function ActionCard({ action, compact }: { action: GrowthCommandAction; compact?: boolean }) {
  return (
    <div className={cn("rounded-lg border border-border bg-background", compact ? "px-3 py-2" : "px-4 py-3")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{action.companyName}</p>
          <p className="text-sm text-foreground">{action.title}</p>
          {!compact ? <p className="mt-1 text-sm text-muted-foreground">{action.why}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <GrowthBadge label={`Impact ${action.impactScore}`} tone="medium" />
            <GrowthBadge label={`${action.effortMinutes} min`} tone="neutral" />
            <GrowthBadge label={`Rev ${action.revenueInfluence}`} tone="neutral" />
          </div>
        </div>
        <Button asChild size="sm">
          <Link href={action.ctaHref}>{action.ctaLabel}</Link>
        </Button>
      </div>
    </div>
  )
}

export function GrowthCommandCenterDashboard() {
  const [dashboard, setDashboard] = useState<GrowthCommandDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [battleFilter, setBattleFilter] = useState<GrowthCommandBossBattleKind | null>(null)
  const [sprintOpen, setSprintOpen] = useState(false)
  const [sprintFullscreen, setSprintFullscreen] = useState(false)
  const [sprintSecondsLeft, setSprintSecondsLeft] = useState(SPRINT_SECONDS)
  const [sprintRunning, setSprintRunning] = useState(false)
  const [sprintCompleted, setSprintCompleted] = useState<Set<string>>(new Set())
  const [sprintSkipped, setSprintSkipped] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/command/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthCommandDashboard
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load command dashboard.")
      }
      setDashboard(data.dashboard)
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

  const sprintPanel = sprintOpen ? (
    <div
      className={cn(
        "rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm",
        sprintFullscreen && "fixed inset-4 z-50 overflow-y-auto bg-background",
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Timer className="size-5 text-indigo-700" />
          <div>
            <h2 className="text-lg font-semibold">Focus Sprint</h2>
            <p className="text-sm text-muted-foreground">30 minutes · 5 prioritized actions · navigation only</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-background px-3 py-1.5 font-mono text-xl font-bold tabular-nums">
            {formatTimer(sprintSecondsLeft)}
          </span>
          <Button type="button" variant="outline" size="icon" onClick={() => setSprintFullscreen((v) => !v)}>
            {sprintFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSprintOpen(false)
              setSprintRunning(false)
              setSprintFullscreen(false)
            }}
          >
            Exit Sprint
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <GrowthBadge label="1 call" tone="neutral" />
        <GrowthBadge label="2 approvals" tone="neutral" />
        <GrowthBadge label="1 research" tone="neutral" />
        <GrowthBadge label="1 sequence" tone="neutral" />
      </div>

      <ul className="space-y-3">
        {sprintActions.map((action, index) => {
          const done = sprintCompleted.has(action.id)
          const skipped = sprintSkipped.has(action.id)
          return (
            <li
              key={action.id}
              className={cn(
                "rounded-lg border px-4 py-3",
                done ? "border-emerald-200 bg-emerald-50/50" : skipped ? "opacity-60" : "border-border bg-background",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Sprint action {index + 1}
                  </p>
                  <p className="font-medium">{action.companyName}</p>
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
                    Complete
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
    <div className="space-y-6">
      {sprintPanel}

      <GrowthEngineCard className="border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-background to-background">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Mission Control</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Today&apos;s Pipeline Operations</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <GrowthBadge label={mission.momentumLabel} tone={momentumTone(mission.momentumState)} />
              <span className="text-sm text-muted-foreground">
                Execution momentum · {dashboard.operatorRankLabel} ({dashboard.operatorScore} pts)
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="lg" className="gap-2" onClick={startSprint}>
              <Zap className="size-4" />
              Start 30 Minute Sprint
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="Critical Actions" value={mission.criticalActions} />
          <StatTile label="Revenue At Risk" value={mission.revenueAtRisk} />
          <StatTile label="Approvals Waiting" value={mission.approvalsWaiting} />
          <StatTile label="Stalled Opportunities" value={mission.stalledOpportunities} />
          <StatTile label="Pipeline Protected" value={mission.pipelineProtected} />
        </div>
      </GrowthEngineCard>

      {dashboard.topWinOpportunity ? (
        <GrowthEngineCard title="Top Win Opportunity" icon={<Target className="size-4" />}>
          <ActionCard action={dashboard.topWinOpportunity} />
        </GrowthEngineCard>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <GrowthEngineCard
            title="Ranked Action Queue"
            icon={<ChevronRight className="size-4" />}
          >
            {battleFilter ? (
              <p className="mb-3 text-sm text-muted-foreground">
                Filtered by boss battle: <span className="font-medium capitalize">{battleFilter.replace(/_/g, " ")}</span>
                <Button type="button" variant="link" className="h-auto px-2" onClick={() => setBattleFilter(null)}>
                  Clear
                </Button>
              </p>
            ) : null}
            {filteredActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No actions in queue.</p>
            ) : (
              <ul className="space-y-3">
                {filteredActions.map((action) => (
                  <li key={action.id}>
                    <ActionCard action={action} />
                  </li>
                ))}
              </ul>
            )}
          </GrowthEngineCard>

          <GrowthEngineCard title="Revenue Rescue Queue" icon={<Flame className="size-4" />}>
            {dashboard.revenueRescueQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No revenue rescue items.</p>
            ) : (
              <ul className="space-y-2">
                {dashboard.revenueRescueQueue.map((action) => (
                  <li key={action.id}>
                    <ActionCard action={action} compact />
                  </li>
                ))}
              </ul>
            )}
          </GrowthEngineCard>
        </div>

        <div className="space-y-6">
          <GrowthEngineCard title="Pipeline Health Rings">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <PipelineRing
                label={dashboard.pipelineRings.execution.label}
                current={dashboard.pipelineRings.execution.current}
                target={dashboard.pipelineRings.execution.target}
              />
              <PipelineRing
                label={dashboard.pipelineRings.protection.label}
                current={dashboard.pipelineRings.protection.current}
                target={dashboard.pipelineRings.protection.target}
              />
              <PipelineRing
                label={dashboard.pipelineRings.growth.label}
                current={dashboard.pipelineRings.growth.current}
                target={dashboard.pipelineRings.growth.target}
              />
            </div>
          </GrowthEngineCard>

          <GrowthEngineCard title="AI Coach" icon={<Sparkles className="size-4" />}>
            <ul className="space-y-2">
              {dashboard.coachTips.map((tip) => (
                <li
                  key={tip.id}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    tip.priority === "high" ? "border-amber-200 bg-amber-50/50" : "border-border",
                  )}
                >
                  {tip.message}
                </li>
              ))}
            </ul>
          </GrowthEngineCard>

          <GrowthEngineCard title="Operator Rank">
            <p className="text-2xl font-bold">{dashboard.operatorRankLabel}</p>
            <p className="mt-1 text-sm text-muted-foreground">{dashboard.operatorScore} execution points today</p>
            {dashboard.comboChains.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {dashboard.comboChains.map((combo) => (
                  <li
                    key={combo.id}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm",
                      combo.completed ? "border-emerald-200 bg-emerald-50/50" : "border-border",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{combo.label}</span>
                      {combo.completed ? (
                        <GrowthBadge label={`+${combo.bonusPoints}`} tone="healthy" />
                      ) : (
                        <span className="text-xs text-muted-foreground">In progress</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </GrowthEngineCard>
        </div>
      </div>

      <GrowthEngineCard title="Boss Battles" icon={<Swords className="size-4" />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dashboard.bossBattles.map((battle) => (
            <div key={battle.kind} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{battle.title}</p>
                <GrowthBadge label={battle.difficulty} tone={difficultyTone(battle.difficulty)} />
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Actions</dt>
                  <dd className="font-medium">{battle.actionsRequired}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Effort</dt>
                  <dd className="font-medium">{battle.effortMinutes} min</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Pipeline influence</dt>
                  <dd className="font-medium">{battle.pipelineInfluence}</dd>
                </div>
              </dl>
              <Button
                type="button"
                className="mt-4 w-full"
                variant={battleFilter === battle.kind ? "default" : "outline"}
                disabled={battle.actionsRequired === 0}
                onClick={() => setBattleFilter(battle.kind)}
              >
                Enter Battle
              </Button>
            </div>
          ))}
        </div>
      </GrowthEngineCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <GrowthEngineCard title="Opportunity Heat Map">
          <div className="grid grid-cols-2 gap-3">
            {dashboard.heatMap.map((bucket) => (
              <div
                key={bucket.bucket}
                className={cn(
                  "rounded-xl border p-4 text-center",
                  bucket.bucket === "hot" && "border-rose-200 bg-rose-50/40",
                  bucket.bucket === "warm" && "border-amber-200 bg-amber-50/40",
                  bucket.bucket === "cool" && "border-border bg-muted/20",
                  bucket.bucket === "at_risk" && "border-red-300 bg-red-50/50",
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide">{heatBucketLabel(bucket.bucket)}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{bucket.count}</p>
              </div>
            ))}
          </div>
        </GrowthEngineCard>

        <GrowthEngineCard title="Win Feed" icon={<Trophy className="size-4" />}>
          {dashboard.winFeed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wins recorded today yet.</p>
          ) : (
            <ul className="space-y-2">
              {dashboard.winFeed.map((win) => (
                <li key={win.id} className="rounded-lg border border-emerald-100 bg-emerald-50/30 px-3 py-2 text-sm">
                  <p className="font-medium">{win.companyName}</p>
                  <p className="text-muted-foreground">{win.label}</p>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="End-of-Day Debrief">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="Impact score" value={dashboard.debrief.impactScore} />
          <StatTile label="Actions completed" value={dashboard.debrief.actionsCompleted} />
          <StatTile label="Sequences advanced" value={dashboard.debrief.sequencesAdvanced} />
          <StatTile label="Relationships recovered" value={dashboard.debrief.relationshipsRecovered} />
          <StatTile label="Pipeline protected" value={dashboard.debrief.pipelineProtected} />
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">Tomorrow&apos;s top 3</p>
          {dashboard.debrief.tomorrowTopActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Queue is clear.</p>
          ) : (
            <ul className="space-y-2">
              {dashboard.debrief.tomorrowTopActions.map((action) => (
                <li key={action.id}>
                  <ActionCard action={action} compact />
                </li>
              ))}
            </ul>
          )}
        </div>
      </GrowthEngineCard>
    </div>
  )
}
