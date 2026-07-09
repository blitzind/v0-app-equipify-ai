"use client"

import { Lightbulb } from "lucide-react"
import { HOME_RUNTIME_EMPTY_MEMORY_MESSAGE } from "@/lib/growth/home/growth-home-runtime-presenter"
import {
  AVA_MEMORY_WHAT_IVE_LEARNED_TITLE,
  GROWTH_MEMORY_ENGINE_QA_MARKER,
  type AvaMemorySummary,
} from "@/lib/growth/memory"

type Props = {
  memorySummary: AvaMemorySummary | null
}

export function GrowthHomeAvaMemorySection({ memorySummary }: Props) {
  const bullets = memorySummary?.learned_insights ?? []

  return (
    <section
      data-qa-section="home-ava-memory"
      data-qa-marker-12a={GROWTH_MEMORY_ENGINE_QA_MARKER}
      className="rounded-2xl border border-border/70 bg-card/60 p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {AVA_MEMORY_WHAT_IVE_LEARNED_TITLE}
        </h2>
      </div>
      {bullets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{HOME_RUNTIME_EMPTY_MEMORY_MESSAGE}</p>
      ) : (
        <ul className="space-y-2">
          {bullets.slice(0, 3).map((insight) => (
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
