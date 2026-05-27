"use client"

import Link from "next/link"
import { Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GrowthExecutionDashboard } from "@/lib/growth/execution/execution-priority-types"
import { executionPriorityBandTone } from "@/lib/growth/execution/execution-priority-score"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"

function momentumTone(state: GrowthExecutionDashboard["morningFocus"]["pipelineMomentum"]) {
  if (state === "building") return "healthy" as const
  if (state === "stable") return "neutral" as const
  if (state === "slipping") return "warning" as const
  return "attention" as const
}

function pressureTone(pressure: number) {
  if (pressure >= 85) return "critical" as const
  if (pressure >= 70) return "attention" as const
  if (pressure >= 50) return "warning" as const
  return "healthy" as const
}

export function GrowthCommandRevenueExecutionSection({
  dashboard,
  onStartSprint,
  startingSprint,
}: {
  dashboard: GrowthExecutionDashboard
  onStartSprint?: (sprintType: string, durationMinutes: number) => void
  startingSprint?: boolean
}) {
  const { morningFocus, summary, operatorScore, recommendedSprints, activeSprint } = dashboard
  const topSprint = recommendedSprints[0] ?? null

  return (
    <GrowthEngineCard
      title="Revenue Execution"
      subtitle="Deterministic priority queue — operator controlled, no autonomous sends"
      icon={<Target className="size-4" />}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Critical execution items" value={String(summary.criticalExecutionItems)} />
        <StatTile label="Revenue protected" value={`$${summary.revenueProtected.toLocaleString()}`} />
        <StatTile label="Follow-up debt" value={String(summary.followUpDebt)} />
        <StatTile label="Risk reduction" value={String(summary.riskReduction)} />
        <StatTile label="Execution completion" value={`${summary.executionCompletionPercent}%`} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          label="Execution score"
          value={`${operatorScore.current.score}/100`}
          hint={`7d ${operatorScore.trend7Day.score} · 30d ${operatorScore.trend30Day.score}`}
        />
        <StatTile label="Operator focus load" value={`${morningFocus.executionCapacity.operatorFocusLoad}%`} />
        <StatTile
          label="Execution pressure"
          value={morningFocus.executionCapacity.executionPressureLabel}
        />
      </div>

      <div className="mt-6 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Top revenue priorities
        </p>
        {morningFocus.topRevenuePriorities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Execution queue is clear.</p>
        ) : (
          <ul className="space-y-2">
            {morningFocus.topRevenuePriorities.map((item, index) => (
              <li key={item.id} className="rounded-lg border border-border/80 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Priority {index + 1}
                    </p>
                    <p className="text-sm font-medium">{item.companyName}</p>
                    <p className="text-sm text-muted-foreground">{item.title}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <GrowthBadge
                      label={`Score ${item.executionPriorityScore}`}
                      tone={executionPriorityBandTone(item.priorityBand)}
                    />
                    <Button asChild size="sm" variant="outline">
                      <Link href={item.ctaHref}>{item.ctaLabel}</Link>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {topSprint ? (
        <div className="mt-6 rounded-lg border border-indigo-200/80 bg-indigo-50/40 p-4 dark:border-indigo-500/25 dark:bg-indigo-950/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{topSprint.sprintTypeLabel}</p>
              <p className="text-sm text-muted-foreground">
                {topSprint.durationMinutes} min · {topSprint.taskCount} tasks · ~$
                {topSprint.expectedRevenueImpact.toLocaleString()} impact
              </p>
            </div>
            {onStartSprint ? (
              <Button
                type="button"
                size="sm"
                disabled={startingSprint || Boolean(activeSprint)}
                onClick={() => onStartSprint(topSprint.sprintType, topSprint.durationMinutes)}
              >
                {activeSprint ? "Sprint active" : startingSprint ? "Starting…" : "Start sprint"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </GrowthEngineCard>
  )
}

export function GrowthCommandMorningFocusMetrics({
  dashboard,
}: {
  dashboard: GrowthExecutionDashboard
}) {
  const { morningFocus } = dashboard
  const capacity = morningFocus.executionCapacity

  return (
    <>
      <StatTile
        label="Top priorities"
        value={morningFocus.topRevenuePriorities.length}
        className="bg-background/80 p-3.5"
      />
      <StatTile
        label="Revenue protected"
        value={`$${morningFocus.revenueProtectedToday.toLocaleString()}`}
        className="bg-background/80 p-3.5"
      />
      <StatTile
        label="Pipeline momentum"
        value={morningFocus.pipelineMomentumLabel}
        className="bg-background/80 p-3.5"
      />
      <StatTile
        label="Execution capacity"
        value={`${capacity.availableCapacityMinutes}m free`}
        className="bg-background/80 p-3.5"
      />
      <StatTile
        label="Focus load"
        value={`${capacity.operatorFocusLoad}%`}
        className="bg-background/80 p-3.5"
      />
      <StatTile
        label="Pressure meter"
        value={capacity.executionPressureLabel}
        className="bg-background/80 p-3.5"
      />
    </>
  )
}

export function GrowthCommandExecutionPressureBadge({
  pressure,
}: {
  pressure: number
}) {
  return (
    <GrowthBadge
      label={`Pressure ${pressure}%`}
      tone={pressureTone(pressure)}
    />
  )
}

export function GrowthCommandPipelineMomentumBadge({
  momentum,
  label,
}: {
  momentum: GrowthExecutionDashboard["morningFocus"]["pipelineMomentum"]
  label: string
}) {
  return <GrowthBadge label={label} tone={momentumTone(momentum)} />
}
