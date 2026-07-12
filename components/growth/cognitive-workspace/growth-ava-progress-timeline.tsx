"use client"

import { Check } from "lucide-react"
import type { GrowthAvaProgressStep } from "@/lib/growth/cognitive-workspace/growth-cognitive-workspace-types"

type Props = {
  steps: GrowthAvaProgressStep[]
}

export function GrowthAvaProgressTimeline({ steps }: Props) {
  if (steps.length === 0) {
    return <p className="text-sm text-muted-foreground">No progress signals yet.</p>
  }

  return (
    <ol className="space-y-1.5" data-qa-marker="ge-aios-25b-progress-timeline">
      {steps.map((step) => {
        const done = step.status === "done"
        const current = step.status === "current"
        return (
          <li
            key={step.id}
            className={`flex items-center gap-2.5 text-sm ${
              done
                ? "text-foreground"
                : current
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
            }`}
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                done
                  ? "border-emerald-600/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : current
                    ? "border-foreground/40 bg-foreground/5"
                    : "border-border bg-transparent"
              }`}
              aria-hidden
            >
              {done ? <Check className="size-3" strokeWidth={3} /> : current ? "●" : ""}
            </span>
            <span>{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
