"use client"

import Link from "next/link"
import { ArrowRight, Bot, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import type { GrowthHomeLeadPoolSummary } from "@/lib/growth/home/growth-home-lead-pool-pagination"
import {
  buildHomeRelationshipScaleLine,
  GROWTH_HOME_RUNTIME_INTEGRATION_16X_QA_MARKER,
} from "@/lib/growth/home/growth-home-runtime-presenter"
import {
  AVA_NARRATIVE_ALL_NORMAL_LINE,
  AVA_NARRATIVE_PRIORITY_TITLE,
  AVA_DAILY_ACTIVITY_SECTION_LABELS,
  AVA_DAILY_ACTIVITY_SECTION_ORDER,
  GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER,
} from "@/lib/growth/ava-home/narrative"
import {
  GROWTH_HOME_AVA_HERO_7A_QA_MARKER,
  type GrowthHomeAvaHeroViewModel,
} from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import {
  buildNarrativeIntelligenceOpeningLine,
  GROWTH_AVA_NARRATIVE_INTELLIGENCE_18F_QA_MARKER,
} from "@/lib/growth/ava-home/narrative/engine/growth-home-narrative-intelligence-18f"
import { GROWTH_OPERATOR_REVIEW_CTA_LABEL } from "@/lib/growth/aios/operator-experience/growth-operator-home-language-2c"
import {
  GROWTH_HOME_LIVING_EXPERIENCE_18E_QA_MARKER,
  HOME_LIVING_ALL_CLEAR_WITH_NARRATIVE,
} from "@/lib/growth/home/growth-home-living-experience-18e"
import { GROWTH_SALES_OPERATIONS_CENTER_ROUTE } from "@/lib/growth/operations-center/growth-sales-operations-center-types"
import { GROWTH_AVA_ABOUT_WORKSPACE_ROUTE } from "@/lib/growth/ava-about/growth-ava-about-workspace-types"
import { GROWTH_TRAINING_WORKSPACE_ROUTE } from "@/lib/growth/training/growth-training-workspace-types"

type Props = {
  hero: GrowthHomeAvaHeroViewModel
  lastUpdateLabel?: string | null
  leadPool?: GrowthHomeLeadPoolSummary | null
  leadsNeedingAction?: number
  pendingApprovals?: number
  relationshipSnapshotCount?: number
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
  relationshipSnapshotCount = 0,
}: Props) {
  const { teammate } = useAiTeammateIdentity()
  const scaleLine = buildHomeRelationshipScaleLine(leadPool, {
    relationshipSnapshotCount,
    leadsNeedingAction,
  })
  const dailyActivityNarrative = hero.dailyActivityNarrative
  const sectionOrder = dailyActivityNarrative?.section_order ?? AVA_DAILY_ACTIVITY_SECTION_ORDER
  const sectionGroups = dailyActivityNarrative
    ? sectionOrder
        .map((section) => ({
          section,
          label: AVA_DAILY_ACTIVITY_SECTION_LABELS[section],
          lines: dailyActivityNarrative.lines.filter((row) => row.section === section),
        }))
        .filter((group) => group.lines.length > 0)
    : []
  const dailyActivityLines = dailyActivityNarrative?.lines.map((row) => row.text) ?? []
  const briefingSummary = hero.dailyBriefing?.summary?.trim() ?? null
  const storyBlocks = hero.storyBlocks ?? []
  const narrativeLines =
    dailyActivityLines.length > 0
      ? dailyActivityLines
      : briefingSummary
        ? [briefingSummary]
        : storyBlocks.map((block) => block.text)
  const hasStructuredNarrative = sectionGroups.length > 0
  const hasNarrative = hasStructuredNarrative || narrativeLines.length > 0
  const openingLine = buildNarrativeIntelligenceOpeningLine({
    focus: dailyActivityNarrative?.focus ?? "idle",
    hasPrimaryDecision: Boolean(hero.primaryDecision),
    completedCount: dailyActivityNarrative?.completed_today.length ?? 0,
    waitingCount: dailyActivityNarrative?.waiting_on_you.filter((line) => !/No packages are waiting/i.test(line)).length ?? 0,
    packageCount: pendingApprovals,
    setupIncomplete: dailyActivityNarrative?.focus === "setup",
    discoveryTarget: hero.discoveryNarrativeTarget ?? null,
  })
  const allClearLine = hasNarrative
    ? HOME_LIVING_ALL_CLEAR_WITH_NARRATIVE
    : hero.allNormalLine || AVA_NARRATIVE_ALL_NORMAL_LINE

  return (
    <section
      data-qa-section="home-ava-hero"
      data-qa-marker={hero.qaMarker}
      data-qa-marker-18e={GROWTH_HOME_LIVING_EXPERIENCE_18E_QA_MARKER}
      data-qa-marker-18f={GROWTH_AVA_NARRATIVE_INTELLIGENCE_18F_QA_MARKER}
      data-qa-marker-narrative={hero.dailyBriefing?.qaMarker ?? GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER}
      data-qa-marker-daily-activity={hero.dailyActivityNarrative?.qaMarker ?? undefined}
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

      {openingLine ? (
        <p className="text-sm leading-relaxed text-foreground" data-qa-field="home-living-opening-line">
          {openingLine}
        </p>
      ) : null}

      {hero.supervisedSalesProgress &&
      (!hero.supervisedSalesProgress.headlineSuppressed || hero.supervisedSalesProgress.secondaryContext) ? (
        <div className="space-y-1" data-qa-section="supervised-sales-progress">
          {!hero.supervisedSalesProgress.headlineSuppressed ? (
            <p className="text-sm font-medium leading-relaxed text-foreground" data-qa-field="supervised-sales-headline">
              {hero.supervisedSalesProgress.headline}
            </p>
          ) : null}
          {!hero.supervisedSalesProgress.headlineSuppressed &&
          hero.supervisedSalesProgress.supportingSentence ? (
            <p className="text-sm leading-relaxed text-muted-foreground" data-qa-field="supervised-sales-supporting">
              {hero.supervisedSalesProgress.supportingSentence}
            </p>
          ) : null}
          {hero.supervisedSalesProgress.secondaryContext ? (
            <p className="text-sm leading-relaxed text-muted-foreground" data-qa-field="supervised-sales-secondary">
              {hero.supervisedSalesProgress.secondaryContext}
            </p>
          ) : null}
          {hero.supervisedSalesProgress.completedSummary ? (
            <p className="text-xs leading-relaxed text-muted-foreground" data-qa-field="supervised-sales-completed">
              {hero.supervisedSalesProgress.completedSummary}
            </p>
          ) : null}
          {!hero.primaryDecision &&
          hero.supervisedSalesProgress.href &&
          hero.supervisedSalesProgress.ctaLabel ? (
            <Button asChild size="sm" variant="outline" className="mt-2">
                  <Link href={hero.supervisedSalesProgress.href}>{GROWTH_OPERATOR_REVIEW_CTA_LABEL}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {hasNarrative ? (
        <div className="space-y-3">
          {hasStructuredNarrative ? (
            <div className="space-y-4">
              {sectionGroups.map((group) => (
                <div
                  key={group.section}
                  className="space-y-2"
                  data-qa-section={`daily-activity-${group.section}`}
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                    {group.label}
                  </p>
                  <ul className="space-y-2.5">
                    {group.lines.map((line, index) => (
                      <li
                        key={`daily-activity:${group.section}:${index}`}
                        className="flex items-start gap-3 text-sm leading-relaxed text-foreground"
                      >
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
                        <span>{line.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {narrativeLines.map((line, index) => (
                <li key={`daily-activity:${index}`} className="flex items-start gap-3 text-sm leading-relaxed text-foreground">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {hasNarrative ? (
        <p className="text-xs text-muted-foreground">
          <Link href={GROWTH_SALES_OPERATIONS_CENTER_ROUTE} className="font-medium text-indigo-700 hover:underline dark:text-indigo-300">
            Open Operations
          </Link>
          {" "}for the full breakdown of why {teammate.name} chose today&apos;s plan.
          {" "}
          <Link href={GROWTH_AVA_ABOUT_WORKSPACE_ROUTE} className="font-medium text-indigo-700 hover:underline dark:text-indigo-300">
            About Your AI
          </Link>
          .
          {dailyActivityNarrative?.focus === "setup" ? (
            <>
              {" "}
              <Link href={GROWTH_TRAINING_WORKSPACE_ROUTE} className="font-medium text-indigo-700 hover:underline dark:text-indigo-300">
                Continue Training
              </Link>
              {" "}to teach me your business.
            </>
          ) : null}
        </p>
      ) : dailyActivityNarrative?.focus === "setup" ? (
        <p className="text-xs text-muted-foreground">
          <Link href={GROWTH_TRAINING_WORKSPACE_ROUTE} className="font-medium text-indigo-700 hover:underline dark:text-indigo-300">
            Open Training
          </Link>
          {" "}to teach {teammate.name} about your business.
        </p>
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
                {hero.primaryDecision.canonicalProjection?.thenActions[0] ? (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                    Then: {hero.primaryDecision.canonicalProjection.thenActions[0]}
                  </p>
                ) : null}
                {hero.primaryDecision.canonicalProjection?.doNotActions[0] ? (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                    Do not: {hero.primaryDecision.canonicalProjection.doNotActions[0]}
                  </p>
                ) : null}
              </div>
              {hero.primaryDecision.href ? (
                <Button asChild size="sm">
                  <Link href={hero.primaryDecision.href}>
                    {GROWTH_OPERATOR_REVIEW_CTA_LABEL}
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
            <p className="text-sm font-medium text-foreground">{allClearLine}</p>
          </div>
        )}
      </div>
    </section>
  )
}

export { GROWTH_HOME_AVA_HERO_7A_QA_MARKER }
