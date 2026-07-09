"use client"

import { CheckCircle2, Circle, PauseCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  buildHomeDefaultOperatingRhythmPhases,
  HOME_RUNTIME_EMPTY_PROGRESS_MESSAGE,
} from "@/lib/growth/home/growth-home-runtime-presenter"
import {
  AVA_OPERATING_RHYTHM_TODAY_PROGRESS_TITLE,
  GROWTH_OPERATING_RHYTHM_QA_MARKER,
  type AvaOperatingPhaseEntry,
  type AvaOperatingRhythm,
} from "@/lib/growth/operating-rhythm"

type Props = {
  operatingRhythm: AvaOperatingRhythm | null
}

function PhaseIcon({ status }: { status: AvaOperatingPhaseEntry["status"] }) {
  if (status === "completed") {
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
  }
  if (status === "blocked") {
    return <PauseCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
  }
  if (status === "active") {
    return <Circle className="size-4 shrink-0 fill-indigo-500 text-indigo-500" aria-hidden />
  }
  return <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
}

function statusSuffix(status: AvaOperatingPhaseEntry["status"]): string {
  if (status === "completed") return "✓"
  if (status === "active") return "●"
  if (status === "blocked") return "!"
  return "○"
}

export function GrowthHomeAvaOperatingRhythmSection({ operatingRhythm }: Props) {
  const phaseTimeline =
    operatingRhythm?.phase_timeline?.length
      ? operatingRhythm.phase_timeline
      : buildHomeDefaultOperatingRhythmPhases()
  const usingFallback = !operatingRhythm?.phase_timeline?.length

  return (
    <section
      data-qa-section="home-ava-operating-rhythm"
      data-qa-marker-13a={GROWTH_OPERATING_RHYTHM_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm"
    >
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {AVA_OPERATING_RHYTHM_TODAY_PROGRESS_TITLE}
      </h2>
      {usingFallback ? (
        <p className="mb-3 text-sm text-muted-foreground">{HOME_RUNTIME_EMPTY_PROGRESS_MESSAGE}</p>
      ) : null}
      <ul className="space-y-2">
        {phaseTimeline.map((phase) => (
          <li
            key={phase.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm",
              phase.status === "active" && "bg-indigo-50/60 dark:bg-indigo-950/20",
              phase.status === "blocked" && "bg-amber-50/40 dark:bg-amber-950/15",
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <PhaseIcon status={phase.status} />
              <span
                className={cn(
                  "truncate",
                  phase.status === "completed" && "text-foreground",
                  phase.status === "active" && "font-medium text-foreground",
                  phase.status === "pending" && "text-muted-foreground",
                )}
              >
                {phase.label}
              </span>
            </div>
            <span
              className={cn(
                "shrink-0 text-xs font-medium tabular-nums",
                phase.status === "completed" && "text-emerald-700 dark:text-emerald-300",
                phase.status === "active" && "text-indigo-700 dark:text-indigo-300",
                phase.status === "blocked" && "text-amber-700 dark:text-amber-300",
                phase.status === "pending" && "text-muted-foreground",
              )}
              aria-hidden
            >
              {statusSuffix(phase.status)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
