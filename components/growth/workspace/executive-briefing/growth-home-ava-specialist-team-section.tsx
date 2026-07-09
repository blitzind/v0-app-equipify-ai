"use client"

import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  buildTeammateHandlingRows,
  GROWTH_HOME_RUNTIME_INTEGRATION_16X_QA_MARKER,
  GROWTH_HOME_SINGLE_AI_IDENTITY_19C_2A_QA_MARKER,
  GROWTH_HOME_TEAMMATE_HANDLING_SECTION_TITLE,
} from "@/lib/growth/home/growth-home-runtime-presenter"
import { normalizeAvaSpecialistOrchestratorResult } from "@/lib/growth/home/growth-home-runtime-safe-defaults"
import {
  GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER,
  type AvaSpecialistOrchestratorResult,
} from "@/lib/growth/specialists/types"

type Props = {
  specialistOrchestrator: AvaSpecialistOrchestratorResult | null
}

export function GrowthHomeAvaSpecialistTeamSection({ specialistOrchestrator }: Props) {
  const orchestrator = normalizeAvaSpecialistOrchestratorResult(specialistOrchestrator)
  const handlingRows = buildTeammateHandlingRows(orchestrator?.team_status)

  return (
    <section
      data-qa-section="home-ava-specialist-team"
      data-qa-marker-14a={GROWTH_SPECIALIST_ORCHESTRATOR_QA_MARKER}
      data-qa-marker-16x={GROWTH_HOME_RUNTIME_INTEGRATION_16X_QA_MARKER}
      data-qa-marker-19c-2a={GROWTH_HOME_SINGLE_AI_IDENTITY_19C_2A_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="size-4 text-indigo-600 dark:text-indigo-400" aria-hidden />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {GROWTH_HOME_TEAMMATE_HANDLING_SECTION_TITLE}
        </h2>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {handlingRows.map((row) => (
          <li
            key={row.id}
            className={cn(
              "rounded-lg border border-border/60 px-3 py-2.5",
              row.activeCount > 0 && !row.comingSoon && "bg-indigo-50/40 dark:bg-indigo-950/15",
              row.comingSoon && "bg-muted/20",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{row.capabilityLabel}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{row.statusLabel}</p>
              </div>
              {row.activeCount > 0 && !row.comingSoon ? (
                <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                  {row.activeCount} active
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
