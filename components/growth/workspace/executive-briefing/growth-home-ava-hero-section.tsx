"use client"

import Link from "next/link"
import { ArrowRight, Bot, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import type { GrowthHomeLeadPoolSummary } from "@/lib/growth/home/growth-home-lead-pool-pagination"
import {
  buildHomeRelationshipScaleLine,
  buildHomeRuntimeBriefingIntro,
  GROWTH_HOME_RUNTIME_INTEGRATION_16X_QA_MARKER,
} from "@/lib/growth/home/growth-home-runtime-presenter"
import {
  AVA_NARRATIVE_ALL_NORMAL_LINE,
  AVA_NARRATIVE_PRIORITY_TITLE,
  GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER,
} from "@/lib/growth/ava-home/narrative"
import {
  GROWTH_HOME_AVA_HERO_7A_QA_MARKER,
  type GrowthHomeAvaHeroViewModel,
} from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"

type Props = {
  hero: GrowthHomeAvaHeroViewModel
  lastUpdateLabel?: string | null
  leadPool?: GrowthHomeLeadPoolSummary | null
  leadsNeedingAction?: number
  pendingApprovals?: number
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

export function GrowthHomeAvaHeroSection({
  hero,
  lastUpdateLabel = null,
  leadPool = null,
  leadsNeedingAction = 0,
  pendingApprovals = 0,
}: Props) {
  const teammate = resolveAiTeammatePresentation()
  const scaleLine = buildHomeRelationshipScaleLine(leadPool)
  const introLines = buildHomeRuntimeBriefingIntro({
    leadPool,
    leadsNeedingAction,
    pendingApprovals,
    activeWork: hero.workManager?.active_work ?? null,
    waitingCount: Math.max(hero.additionalDecisionCount, pendingApprovals),
  })
  const briefingSummary = hero.dailyBriefing?.summary?.trim() ?? null
  const storyBlocks = hero.storyBlocks ?? []
  const introSet = new Set(introLines.map((line) => line.trim()))
  const supplementalBlocks = storyBlocks.filter((block) => !introSet.has(block.text.trim()))
  const narrativeLines =
    introLines.length > 0
      ? introLines
      : briefingSummary
        ? [briefingSummary]
        : []
  const hasNarrative = narrativeLines.length > 0 || supplementalBlocks.length > 0

  return (
    <section
      data-qa-section="home-ava-hero"
      data-qa-marker={hero.qaMarker}
      data-qa-marker-narrative={hero.dailyBriefing?.qaMarker ?? GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER}
      data-qa-marker-16x={GROWTH_HOME_RUNTIME_INTEGRATION_16X_QA_MARKER}
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
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                statusTone(hero.statusKind),
              )}
            >
              {hero.statusLabel}
            </span>
          </div>
        </div>
        {lastUpdateLabel ? <p className="text-[11px] text-muted-foreground">Updated {lastUpdateLabel}</p> : null}
      </div>

      {scaleLine ? (
        <p className="text-sm leading-relaxed text-muted-foreground" data-qa-field="home-relationship-scale-line">
          {scaleLine}
        </p>
      ) : null}

      {hasNarrative ? (
        <div className="space-y-3">
          <ul className="space-y-2.5">
            {narrativeLines.map((line, index) => (
              <li key={`intro:${index}`} className="flex items-start gap-3 text-sm leading-relaxed text-foreground">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
            {supplementalBlocks.slice(0, introLines.length > 0 ? 2 : 5).map((block) => (
              <li key={block.id} className="flex items-start gap-3 text-sm leading-relaxed text-foreground">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
                {block.href ? (
                  <Link href={block.href} className="hover:text-primary hover:underline">
                    {block.text}
                  </Link>
                ) : (
                  <span>{block.text}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={cn(hasNarrative && "border-t border-border/50 pt-4")}>
        {hero.primaryDecision ? (
          <div
            className={cn(
              "rounded-xl border p-4",
              "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              {AVA_NARRATIVE_PRIORITY_TITLE}
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
            <p className="text-sm font-medium text-foreground">{hero.allNormalLine || AVA_NARRATIVE_ALL_NORMAL_LINE}</p>
          </div>
        )}
      </div>
    </section>
  )
}

export { GROWTH_HOME_AVA_HERO_7A_QA_MARKER }
