"use client"

import Link from "next/link"
import { useMemo } from "react"
import { ArrowRight, Bot, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import type {
  GrowthHomeExecutiveBriefingHero,
  GrowthHomeExecutiveKpiCard,
  GrowthHomeExecutiveRecommendation,
  GrowthHomeRecommendation,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  GROWTH_HOME_AVA_RECOMMENDS,
  GROWTH_HOME_NO_OPPORTUNITY,
  GROWTH_HOME_NO_RECOMMENDATION,
  GROWTH_HOME_NO_RISK,
  GROWTH_HOME_OPPORTUNITY_LABEL,
  GROWTH_HOME_PIPELINE_HEALTHY,
  GROWTH_HOME_RECOMMENDATION_IMPACT,
  GROWTH_HOME_RISK_LABEL,
  GROWTH_HOME_SUPPORTING_METRICS,
  GROWTH_HOME_TODAY_AT_A_GLANCE,
  GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER,
  resolveAvaTeammateStatusLine,
  resolveHomeContextualIntroLine,
  resolveHomeDayPart,
} from "@/lib/growth/workspace/executive-briefing/growth-home-experience-2b"
import { GROWTH_WORKSPACE_DASHBOARD_REFINEMENT_2A_QA_MARKER } from "@/lib/growth/workspace/executive-briefing/growth-home-dashboard-refinement-2a"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { cn } from "@/lib/utils"

type Props = {
  hero: GrowthHomeExecutiveBriefingHero
  statusLabel?: string | null
  activityLabel?: string | null
  lastUpdateLabel?: string | null
  executiveRecommendation?: GrowthHomeExecutiveRecommendation | null
  recommendation?: GrowthHomeRecommendation | null
}

function ExecutiveKpiCard({ kpi }: { kpi: GrowthHomeExecutiveKpiCard }) {
  return (
    <div className="rounded-lg bg-muted/30 px-2.5 py-2 dark:bg-muted/20">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{kpi.title}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-foreground">{kpi.value}</p>
      <p className="text-[11px] text-muted-foreground">{kpi.status}</p>
    </div>
  )
}

function AlertStrip({
  label,
  title,
  detail,
  ctaLabel,
  ctaHref,
  tone,
}: {
  label: string
  title: string
  detail?: string | null
  ctaLabel?: string
  ctaHref?: string
  tone: "opportunity" | "risk" | "neutral"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg px-3 py-2.5",
        tone === "opportunity" && "bg-emerald-500/8 dark:bg-emerald-500/10",
        tone === "risk" && "bg-amber-500/8 dark:bg-amber-500/10",
        tone === "neutral" && "bg-muted/30 dark:bg-muted/20",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium leading-snug text-foreground line-clamp-1">{title}</p>
      {detail ? <p className="text-xs text-muted-foreground line-clamp-1">{detail}</p> : null}
      {ctaLabel && ctaHref ? (
        <Link href={ctaHref} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          {ctaLabel}
          <ArrowRight className="size-3" />
        </Link>
      ) : null}
    </div>
  )
}

function HeroRecommendationPanel({
  executiveRecommendation,
  recommendation,
}: {
  executiveRecommendation?: GrowthHomeExecutiveRecommendation | null
  recommendation?: GrowthHomeRecommendation | null
}) {
  const headline = executiveRecommendation?.headline ?? recommendation?.headline
  const reason =
    executiveRecommendation?.sentence ??
    recommendation?.whyItMatters ??
    executiveRecommendation?.evidence?.[0] ??
    null
  const expectedOutcome =
    executiveRecommendation?.expectedResults?.[0] ??
    recommendation?.expectedImpact ??
    null
  const primaryHref = executiveRecommendation?.href ?? recommendation?.primaryCtaHref ?? null
  const primaryLabel = recommendation?.primaryCtaLabel ?? "Review now"

  if (!headline && !reason) {
    return (
      <div className="rounded-xl bg-muted/25 px-4 py-3 dark:bg-muted/15">
        <p className="text-sm text-muted-foreground">{GROWTH_HOME_NO_RECOMMENDATION}</p>
        <p className="mt-1 text-xs text-muted-foreground">{GROWTH_HOME_PIPELINE_HEALTHY}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-indigo-600 px-4 py-4 text-white shadow-lg shadow-indigo-600/20 ring-1 ring-indigo-500/30 dark:bg-indigo-600 dark:shadow-indigo-950/40">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-100">{GROWTH_HOME_AVA_RECOMMENDS}</p>
      {headline ? <p className="mt-2 text-lg font-semibold leading-snug">{headline}</p> : null}
      {reason ? <p className="mt-2 text-sm leading-relaxed text-indigo-50/95 line-clamp-2">{reason}</p> : null}
      {expectedOutcome ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
            {GROWTH_HOME_RECOMMENDATION_IMPACT}
          </p>
          <p className="mt-0.5 text-sm text-indigo-50/95 line-clamp-2">{expectedOutcome}</p>
        </div>
      ) : null}
      {primaryHref ? (
        <Button asChild size="sm" className="mt-4 bg-white text-indigo-700 hover:bg-indigo-50">
          <Link href={primaryHref}>{primaryLabel}</Link>
        </Button>
      ) : null}
    </div>
  )
}

export function GrowthHomeExecutiveBriefingHeroSection({
  hero,
  statusLabel = "Working",
  activityLabel = null,
  lastUpdateLabel = null,
  executiveRecommendation = null,
  recommendation = null,
}: Props) {
  const teammate = resolveAiTeammatePresentation()
  const contextualIntro = useMemo(() => {
    return resolveHomeContextualIntroLine(resolveHomeDayPart(new Date().getHours()))
  }, [])

  const avaStatusLine = resolveAvaTeammateStatusLine(statusLabel ?? "Working", activityLabel)
  const glanceLines =
    hero.todayAtAGlance.length > 0
      ? hero.todayAtAGlance
      : hero.revenueToday.slice(0, 3).map((metric) => `${metric.label}: ${metric.value}`)

  const kpis = hero.executiveKpis

  return (
    <section
      data-qa-section="home-executive-briefing-hero"
      data-qa-marker={GROWTH_WORKSPACE_DASHBOARD_REFINEMENT_2A_QA_MARKER}
      data-home-experience-2b={GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER}
      className="space-y-3.5 rounded-2xl border border-border/50 bg-card/70 p-3.5 backdrop-blur-sm dark:border-border/40 dark:bg-card/60 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
            <Bot className="size-3.5" aria-hidden />
          </span>
          <p className="text-sm font-medium text-foreground">{teammate.name}</p>
        </div>
        {lastUpdateLabel ? (
          <p className="text-[11px] text-muted-foreground">Updated {lastUpdateLabel}</p>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">{avaStatusLine}</p>

      <div className="space-y-0.5">
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-foreground sm:text-2xl">{hero.greeting}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{contextualIntro}</p>
      </div>

      {glanceLines.length > 0 ? (
        <div data-section="home-today-at-a-glance">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {GROWTH_HOME_TODAY_AT_A_GLANCE}
          </p>
          <ul className="mt-2 space-y-1.5">
            {glanceLines.map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div data-section="home-hero-ava-recommends">
        <HeroRecommendationPanel
          executiveRecommendation={executiveRecommendation}
          recommendation={recommendation}
        />
      </div>

      {kpis.length > 0 ? (
        <div data-section="home-executive-kpis">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {GROWTH_HOME_SUPPORTING_METRICS}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <ExecutiveKpiCard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 xl:grid-cols-2" data-section="home-executive-action-cards">
        {hero.opportunityAction ? (
          <AlertStrip
            label={GROWTH_HOME_OPPORTUNITY_LABEL}
            title={hero.opportunityAction.title}
            detail={hero.opportunityAction.detail}
            ctaLabel={hero.opportunityAction.ctaLabel}
            ctaHref={hero.opportunityAction.ctaHref}
            tone="opportunity"
          />
        ) : (
          <AlertStrip label={GROWTH_HOME_OPPORTUNITY_LABEL} title={GROWTH_HOME_NO_OPPORTUNITY} tone="neutral" />
        )}
        {hero.riskAction ? (
          <AlertStrip
            label={GROWTH_HOME_RISK_LABEL}
            title={hero.riskAction.title}
            detail={hero.riskAction.detail}
            ctaLabel={hero.riskAction.ctaLabel}
            ctaHref={hero.riskAction.ctaHref}
            tone="risk"
          />
        ) : (
          <AlertStrip label={GROWTH_HOME_RISK_LABEL} title={GROWTH_HOME_NO_RISK} tone="neutral" />
        )}
      </div>
    </section>
  )
}
