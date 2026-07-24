"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowRight, ChevronDown, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthHomeProgressBar } from "@/components/growth/workspace/executive-briefing/growth-home-progress-bar"
import { GROWTH_AIOS_MISSION_ORCHESTRATION_1A_QA_MARKER } from "@/lib/growth/aios/missions/growth-canonical-mission-1a-types"
import type { GrowthCanonicalMission } from "@/lib/growth/aios/missions/growth-canonical-mission-1a-types"
import { AVA_GROWTH_OPERATOR_2A_EXECUTIVE_EXPERIENCE_QA_MARKER } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-experience-2a"

type Props = {
  missions: GrowthCanonicalMission[]
  overflowMissionCount?: number
  totalMissionCount?: number
  executiveMode?: boolean
}

function missionProgressPercent(mission: GrowthCanonicalMission): number {
  const stages = mission.progress
  if (!stages.length) return 0
  const filled = stages.reduce((sum, row) => sum + row.filledSegments, 0)
  const total = stages.reduce((sum, row) => sum + row.totalSegments, 0)
  return total > 0 ? Math.round((filled / total) * 100) : 0
}

export function GrowthHomeCanonicalMissionsSection({
  missions,
  overflowMissionCount = 0,
  totalMissionCount,
  executiveMode = false,
}: Props) {
  const [expandedMissionIds, setExpandedMissionIds] = useState<Record<string, boolean>>({})

  if (missions.length === 0) return null

  const total = totalMissionCount ?? missions.length + overflowMissionCount

  return (
    <section
      data-qa-section="home-canonical-missions"
      data-qa-marker={GROWTH_AIOS_MISSION_ORCHESTRATION_1A_QA_MARKER}
      data-executive-mode={executiveMode ? "true" : "false"}
      data-qa-marker-2a={executiveMode ? AVA_GROWTH_OPERATOR_2A_EXECUTIVE_EXPERIENCE_QA_MARKER : undefined}
      className="rounded-2xl border border-border/70 bg-card p-5 space-y-4 sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Active Missions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {executiveMode
            ? "What I'm doing, why, and what I need from you."
            : total > missions.length
              ? `Showing ${missions.length} of ${total} active missions — open an account for full detail.`
              : "Every account has one mission — follow Ava through the same work from any screen."}
        </p>
      </div>

      <div className="space-y-4">
        {missions.map((mission) => {
          const expanded = !executiveMode || expandedMissionIds[mission.missionId] === true

          return (
          <article
            key={mission.missionId}
            className="rounded-xl border border-border/60 bg-background/80 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-base font-semibold">{mission.missionTitle}</p>
                {!executiveMode ? (
                  <p className="text-sm text-muted-foreground">{mission.currentObjective}</p>
                ) : null}
              </div>
              <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                {mission.activePhaseLabel}
              </span>
            </div>

            {executiveMode ? (
              <div className="grid gap-2 text-sm">
                <div className="rounded-lg bg-muted/20 px-2.5 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">What I'm doing</p>
                  <p className="font-medium">{mission.nextAvaAction}</p>
                </div>
                {mission.nextOperatorAction ? (
                  <div className="rounded-lg bg-muted/20 px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">What I need from you</p>
                    <p className="font-medium">{mission.nextOperatorAction}</p>
                  </div>
                ) : null}
                {mission.expectedOutcome ? (
                  <div className="rounded-lg bg-muted/20 px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">After approval</p>
                    <p className="font-medium">{mission.expectedOutcome}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <GrowthHomeProgressBar percent={missionProgressPercent(mission)} />
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-muted/20 px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Next Ava action</p>
                    <p className="font-medium">{mission.nextAvaAction}</p>
                  </div>
                  {mission.nextOperatorAction ? (
                    <div className="rounded-lg bg-muted/20 px-2.5 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Your action</p>
                      <p className="font-medium">{mission.nextOperatorAction}</p>
                    </div>
                  ) : null}
                </div>
              </>
            )}

            {expanded && !executiveMode && mission.currentBlocker ? (
              <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                <span className="font-medium">Blocked · </span>
                {mission.currentBlocker}
              </p>
            ) : null}

            {expanded && !executiveMode && mission.expectedOutcome ? (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Target className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <p>
                  <span className="font-medium text-foreground">Expected outcome · </span>
                  {mission.expectedOutcome}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
              <Button asChild size="sm">
                <Link href={mission.workspaceHref}>
                  Open mission
                  <ArrowRight className="ml-1 size-3.5" aria-hidden />
                </Link>
              </Button>
              {executiveMode ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() =>
                    setExpandedMissionIds((current) => ({
                      ...current,
                      [mission.missionId]: !current[mission.missionId],
                    }))
                  }
                >
                  {expanded ? "Hide details" : "Show details"}
                  <ChevronDown
                    className={`ml-1 size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </Button>
              ) : null}
              {expanded && mission.confidenceSummary ? (
                <span className="text-xs text-muted-foreground">{mission.confidenceSummary}</span>
              ) : null}
            </div>

            {executiveMode && expanded ? (
              <div className="space-y-3 border-t border-border/50 pt-3 text-sm text-muted-foreground">
                <p>{mission.currentObjective}</p>
                <GrowthHomeProgressBar percent={missionProgressPercent(mission)} />
                {mission.currentBlocker ? (
                  <p>
                    <span className="font-medium text-foreground">Blocked · </span>
                    {mission.currentBlocker}
                  </p>
                ) : null}
                {mission.confidenceSummary ? <p>{mission.confidenceSummary}</p> : null}
              </div>
            ) : null}
          </article>
        )})}
      </div>
    </section>
  )
}
