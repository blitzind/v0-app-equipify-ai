"use client"

import { MessageCircle } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_SAY_THIS_NEXT_QA_MARKER,
  type SayThisNextSnapshot,
} from "@/lib/growth/operator-assist/resolve-say-this-next"
import { cn } from "@/lib/utils"

function formatConfidence(score: number | null): string | null {
  if (score == null) return null
  const normalized = score <= 1 ? Math.round(score * 100) : Math.round(score)
  return `${normalized}%`
}

export function SayThisNextCard({
  sayThisNext,
  coachingActive,
  className,
}: {
  sayThisNext: SayThisNextSnapshot | null
  coachingActive: boolean
  className?: string
}) {
  if (!sayThisNext) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-emerald-400/40 bg-emerald-500/5 px-5 py-6 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10",
          className,
        )}
        data-qa-marker={GROWTH_SAY_THIS_NEXT_QA_MARKER}
      >
        <MessageCircle className="mx-auto mb-2 size-7 text-emerald-600/70 dark:text-emerald-300/70" />
        <p className="text-sm font-semibold text-foreground">Say this next</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {coachingActive
            ? "Listening for transcript — a recommended line will appear here."
            : "Start coaching to get live phrase suggestions."}
        </p>
      </div>
    )
  }

  const confidence = formatConfidence(sayThisNext.confidenceScore)

  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-emerald-400/70 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 px-5 py-5 shadow-sm dark:border-emerald-500/50 dark:from-emerald-950/40 dark:via-slate-950 dark:to-emerald-950/20",
        className,
      )}
      data-qa-marker={GROWTH_SAY_THIS_NEXT_QA_MARKER}
      data-say-this-next-source={sayThisNext.source}
      data-say-this-next-updated-at={sayThisNext.updatedAt}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-800 dark:text-emerald-200">
          <MessageCircle className="size-4" />
          Say this next
        </span>
        {coachingActive ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        ) : null}
        {confidence ? <GrowthBadge label={confidence} tone="healthy" /> : null}
      </div>

      <p
        key={`${sayThisNext.eventId ?? sayThisNext.source}:${sayThisNext.phrase}`}
        className="text-2xl font-semibold leading-snug tracking-tight text-foreground sm:text-3xl"
      >
        &ldquo;{sayThisNext.phrase}&rdquo;
      </p>

      <p className="mt-3 text-sm text-muted-foreground">{sayThisNext.contextLabel}</p>
    </div>
  )
}
