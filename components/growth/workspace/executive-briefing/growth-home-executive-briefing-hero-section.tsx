"use client"

import Link from "next/link"
import { useMemo } from "react"
import { ArrowRight, Bot, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type {
  GrowthHomeAiOsUxViewModel,
  GrowthHomeExecutiveBriefingHero,
  GrowthHomeExecutiveRecommendation,
  GrowthHomeRecommendation,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  GROWTH_HOME_AVA_RECOMMENDS,
  GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER,
  extractFirstNameFromGreeting,
} from "@/lib/growth/workspace/executive-briefing/growth-home-experience-2b"
import {
  GROWTH_HOME_AVA_OPERATOR_TAGLINE,
  GROWTH_HOME_EXECUTIVE_BRIEFING_2A_QA_MARKER,
  GROWTH_HOME_REVIEW_TODAYS_WORK_LABEL,
  GROWTH_HOME_TODAYS_FOCUS_TITLE,
  GROWTH_HOME_VIEW_MISSION_CENTER_LABEL,
  buildHeroBriefingBullets,
  buildHeroNarrativeSummary,
  buildTodaysFocusItems,
  resolveAvaStatusBadgeLabel,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-2a"
import { greetingForHour } from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"
import { GROWTH_WORKSPACE_DASHBOARD_REFINEMENT_2A_QA_MARKER } from "@/lib/growth/workspace/executive-briefing/growth-home-dashboard-refinement-2a"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { cn } from "@/lib/utils"

type Props = {
  hero: GrowthHomeExecutiveBriefingHero
  aiOsUx: GrowthHomeAiOsUxViewModel
  marketingMissionCount: number
  statusLabel?: string | null
  activityLabel?: string | null
  lastUpdateLabel?: string | null
  executiveRecommendation?: GrowthHomeExecutiveRecommendation | null
  recommendation?: GrowthHomeRecommendation | null
  onReviewTodaysWork?: () => void
  onViewMissionCenter?: () => void
}

function StatusBadge({ label }: { label: string }) {
  const tone =
    label === "Waiting on You"
      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
      : label === "Idle"
        ? "border-border bg-muted/40 text-muted-foreground"
        : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"

  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-medium", tone)}>{label}</span>
  )
}

export function GrowthHomeExecutiveBriefingHeroSection({
  hero,
  aiOsUx,
  marketingMissionCount,
  statusLabel = "Working",
  activityLabel = null,
  lastUpdateLabel = null,
  executiveRecommendation = null,
  recommendation = null,
  onReviewTodaysWork,
  onViewMissionCenter,
}: Props) {
  const teammate = resolveAiTeammatePresentation()

  const displayGreeting = useMemo(() => {
    const firstName = extractFirstNameFromGreeting(hero.greeting)
    const base = greetingForHour(new Date().getHours())
    return firstName ? `${base}, ${firstName}.` : `${base}.`
  }, [hero.greeting])

  const statusBadge = resolveAvaStatusBadgeLabel(statusLabel ?? "Working")
  const narrativeSummary = buildHeroNarrativeSummary(marketingMissionCount, hero)
  const briefingBullets = buildHeroBriefingBullets({ hero, aiOsUx })
  const focusItems = buildTodaysFocusItems({ hero, aiOsUx })

  const headline = executiveRecommendation?.headline ?? recommendation?.headline
  const reason =
    executiveRecommendation?.sentence ??
    recommendation?.whyItMatters ??
    executiveRecommendation?.evidence?.[0] ??
    null
  const primaryHref = executiveRecommendation?.href ?? recommendation?.primaryCtaHref ?? null
  const primaryLabel = recommendation?.primaryCtaLabel ?? "Review recommendation"

  return (
    <section
      data-qa-section="home-executive-briefing-hero"
      data-qa-marker={GROWTH_WORKSPACE_DASHBOARD_REFINEMENT_2A_QA_MARKER}
      data-qa-marker-briefing-2a={GROWTH_HOME_EXECUTIVE_BRIEFING_2A_QA_MARKER}
      data-home-experience-2b={GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER}
      className="space-y-4 rounded-2xl border border-border/50 bg-card/70 p-4 backdrop-blur-sm dark:border-border/40 dark:bg-card/60 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
            <Bot className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{teammate.name}</p>
              <StatusBadge label={statusBadge} />
            </div>
            <p className="text-xs text-muted-foreground">{GROWTH_HOME_AVA_OPERATOR_TAGLINE}</p>
            {activityLabel ? <p className="text-xs text-muted-foreground">{activityLabel}</p> : null}
          </div>
        </div>
        {lastUpdateLabel ? (
          <p className="text-[11px] text-muted-foreground">Updated {lastUpdateLabel}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <h1 className="text-[1.5rem] font-semibold tracking-tight text-foreground sm:text-[1.75rem]">{displayGreeting}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-foreground">{narrativeSummary}</p>
      </div>

      {briefingBullets.length > 0 ? (
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {briefingBullets.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/40" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {focusItems.length > 0 ? (
        <div className="space-y-2 border-t border-border/50 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{GROWTH_HOME_TODAYS_FOCUS_TITLE}</p>
          <ul className="space-y-1">
            {focusItems.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                <Sparkles className="size-3.5 shrink-0 text-indigo-500" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(headline || reason) ? (
        <div
          data-section="home-hero-ava-recommends"
          className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 dark:bg-muted/10"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{GROWTH_HOME_AVA_RECOMMENDS}</p>
          {headline ? <p className="mt-1 text-sm font-medium text-foreground">{headline}</p> : null}
          {reason ? <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{reason}</p> : null}
          {primaryHref ? (
            <Button asChild variant="link" size="sm" className="mt-1 h-auto px-0 text-primary">
              <Link href={primaryHref}>
                {primaryLabel}
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
        <Button type="button" size="sm" onClick={onReviewTodaysWork}>
          {GROWTH_HOME_REVIEW_TODAYS_WORK_LABEL}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onViewMissionCenter}>
          {GROWTH_HOME_VIEW_MISSION_CENTER_LABEL}
        </Button>
      </div>
    </section>
  )
}
