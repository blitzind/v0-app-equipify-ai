"use client"

import Link from "next/link"
import { ArrowRight, Bot, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import {
  GROWTH_HOME_AVA_CURRENTLY_TITLE,
  GROWTH_HOME_AVA_ONE_THING_TITLE,
  GROWTH_HOME_AVA_SINCE_LAST_VISIT_TITLE,
  type GrowthHomeAvaHeroViewModel,
} from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"

type Props = {
  hero: GrowthHomeAvaHeroViewModel
  lastUpdateLabel?: string | null
}

function statusTone(kind: GrowthHomeAvaHeroViewModel["statusKind"]): string {
  if (kind === "waiting_for_approval") {
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
  }
  if (kind === "idle") {
    return "border-border bg-muted/40 text-muted-foreground"
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"
}

export function GrowthHomeAvaHeroSection({ hero, lastUpdateLabel = null }: Props) {
  const teammate = resolveAiTeammatePresentation()

  return (
    <section
      data-qa-section="home-ava-hero"
      data-qa-marker={hero.qaMarker}
      className="space-y-5 rounded-2xl border border-border/50 bg-card/70 p-5 backdrop-blur-sm dark:border-border/40 dark:bg-card/60 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
            <Bot className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground">{teammate.name}</p>
            <h1 className="text-[1.5rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[1.75rem]">
              {hero.greeting}
            </h1>
          </div>
        </div>
        {lastUpdateLabel ? <p className="text-[11px] text-muted-foreground">Updated {lastUpdateLabel}</p> : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {GROWTH_HOME_AVA_CURRENTLY_TITLE}
        </p>
        <div className="flex flex-wrap gap-2">
          {hero.currentActivities.map((activity) => (
            <span
              key={activity.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                activity.id === "waiting"
                  ? statusTone("waiting_for_approval")
                  : "border-indigo-200/70 bg-indigo-50/60 text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-100",
              )}
            >
              {activity.id !== "waiting" ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : null}
              {activity.label}
            </span>
          ))}
        </div>
      </div>

      {hero.sinceLastVisit.length > 0 ? (
        <div className="space-y-2 border-t border-border/50 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {GROWTH_HOME_AVA_SINCE_LAST_VISIT_TITLE}
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {hero.sinceLastVisit.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-border/50 pt-4">
        {hero.primaryDecision ? (
          <div
            className={cn(
              "rounded-xl border p-4",
              "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              {GROWTH_HOME_AVA_ONE_THING_TITLE}
            </p>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{hero.primaryDecision.label}</p>
                {hero.primaryDecision.detail ? (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{hero.primaryDecision.detail}</p>
                ) : null}
              </div>
              {hero.primaryDecision.href ? (
                <Button asChild size="sm">
                  <Link href={hero.primaryDecision.href}>
                    Review
                    <ArrowRight className="ml-1.5 size-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
            {hero.additionalDecisionCount > 0 && hero.reviewAllHref ? (
              <Link
                href={hero.reviewAllHref}
                className="mt-2 inline-block text-xs font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-200"
              >
                {hero.additionalDecisionCount} more waiting below
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <p className="text-sm font-medium text-foreground">{hero.allNormalLine}</p>
          </div>
        )}
      </div>
    </section>
  )
}
