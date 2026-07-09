"use client"

import Link from "next/link"
import { ArrowRight, Lightbulb } from "lucide-react"
import { HOME_RUNTIME_EMPTY_MEMORY_MESSAGE } from "@/lib/growth/home/growth-home-runtime-presenter"
import { GROWTH_HOME_CLEANUP_19C_2G_QA_MARKER } from "@/lib/growth/home/growth-home-cleanup-19c-2g"
import { GROWTH_TRAINING_LEARNED_ROUTE } from "@/lib/growth/training/growth-training-workspace-types"
import { buildWhatIveLearnedBullets } from "@/lib/growth/memory/bridges/narrative-memory"
import {
  AVA_MEMORY_WHAT_IVE_LEARNED_TITLE,
  GROWTH_MEMORY_ENGINE_QA_MARKER,
  type AvaMemorySummary,
} from "@/lib/growth/memory"

type Props = {
  memorySummary: AvaMemorySummary | null
}

export function GrowthHomeAvaMemorySection({ memorySummary }: Props) {
  const bullets = buildWhatIveLearnedBullets(memorySummary)

  return (
    <section
      data-qa-section="home-ava-memory"
      data-qa-marker-12a={GROWTH_MEMORY_ENGINE_QA_MARKER}
      data-qa-marker-19c-2g={GROWTH_HOME_CLEANUP_19C_2G_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {AVA_MEMORY_WHAT_IVE_LEARNED_TITLE}
          </h2>
        </div>
        <Link
          href={GROWTH_TRAINING_LEARNED_ROUTE}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline dark:text-indigo-300"
        >
          Full view in Training
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
      {bullets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{HOME_RUNTIME_EMPTY_MEMORY_MESSAGE}</p>
      ) : (
        <ul className="space-y-2">
          {bullets.slice(0, 2).map((insight) => (
            <li key={insight} className="flex gap-2 text-sm text-foreground">
              <span className="shrink-0 text-muted-foreground" aria-hidden>
                •
              </span>
              <span>
                {insight.startsWith("I've learned")
                  ? insight
                  : `I've learned ${insight.charAt(0).toLowerCase()}${insight.slice(1)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
