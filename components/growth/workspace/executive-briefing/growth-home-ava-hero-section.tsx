"use client"

import { useCallback } from "react"
import Link from "next/link"
import { Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import {
  GROWTH_HOME_RUNTIME_INTEGRATION_16X_QA_MARKER,
} from "@/lib/growth/home/growth-home-runtime-presenter"
import { GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER } from "@/lib/growth/ava-home/narrative"
import {
  GROWTH_HOME_AVA_HERO_7A_QA_MARKER,
  type GrowthHomeAvaHeroViewModel,
} from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"
import { GROWTH_AVA_NARRATIVE_INTELLIGENCE_18F_QA_MARKER } from "@/lib/growth/ava-home/narrative/engine/growth-home-narrative-intelligence-18f"
import { GrowthHomeAvaSinceYouWereLastHereSection } from "@/components/growth/workspace/executive-briefing/growth-home-ava-since-you-were-last-here-section"
import { acknowledgeGrowthHomeAvaExecutiveBriefing } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a"
import {
  GROWTH_HOME_LIVING_EXPERIENCE_18E_QA_MARKER,
} from "@/lib/growth/home/growth-home-living-experience-18e"
import { GROWTH_SALES_OPERATIONS_CENTER_ROUTE } from "@/lib/growth/operations-center/growth-sales-operations-center-types"
import { GROWTH_AVA_ABOUT_WORKSPACE_ROUTE } from "@/lib/growth/ava-about/growth-ava-about-workspace-types"
import { GROWTH_TRAINING_WORKSPACE_ROUTE } from "@/lib/growth/training/growth-training-workspace-types"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import {
  buildHeroExecutiveBriefing,
  GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER,
  GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3C_QA_MARKER,
  type GrowthHomeHeroExecutiveBriefing,
} from "@/lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"

type Props = {
  hero: GrowthHomeAvaHeroViewModel
  executiveBriefing?: GrowthHomeHeroExecutiveBriefing | null
  lastUpdateLabel?: string | null
  pendingApprovals?: number
  readyForOutreachReview?: number
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  organizationId?: string | null
  onBriefingAcknowledged?: () => void
  /** GE-AIOS-HOME-UX-CLOSURE-1A — greeting + status only; reasoning moved below fold */
  compact?: boolean
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
  executiveBriefing: executiveBriefingProp = null,
  lastUpdateLabel = null,
  pendingApprovals = 0,
  readyForOutreachReview = 0,
  missionDiscovery = null,
  organizationId = null,
  onBriefingAcknowledged,
  compact = false,
}: Props) {
  const { teammate } = useAiTeammateIdentity()
  const handleBriefingAcknowledge = useCallback(() => {
    const briefing = hero.continuousExecutiveBriefing
    if (!briefing?.currentSnapshot) return
    acknowledgeGrowthHomeAvaExecutiveBriefing({
      organizationId,
      snapshot: briefing.currentSnapshot,
      state: briefing.state,
      headline: briefing.openingLine,
    })
    onBriefingAcknowledged?.()
  }, [hero.continuousExecutiveBriefing, onBriefingAcknowledged, organizationId])

  const dailyActivityNarrative = hero.dailyActivityNarrative
  const executiveBriefing =
    executiveBriefingProp ??
    buildHeroExecutiveBriefing({
      statusLabel: hero.statusLabel,
      dailyActivityNarrative,
      missionDiscovery,
      pendingApprovals,
      readyForOutreachReview,
      discoveryTarget: hero.discoveryNarrativeTarget ?? missionDiscovery?.audienceName ?? null,
    })

  return (
    <section
      data-qa-section="home-ava-hero"
      data-qa-marker={hero.qaMarker}
      data-qa-marker-18e={GROWTH_HOME_LIVING_EXPERIENCE_18E_QA_MARKER}
      data-qa-marker-18f={GROWTH_AVA_NARRATIVE_INTELLIGENCE_18F_QA_MARKER}
      data-qa-marker-narrative={hero.dailyBriefing?.qaMarker ?? GROWTH_AVA_NARRATIVE_ENGINE_QA_MARKER}
      data-qa-marker-daily-activity={hero.dailyActivityNarrative?.qaMarker ?? undefined}
      data-qa-marker-16x={GROWTH_HOME_RUNTIME_INTEGRATION_16X_QA_MARKER}
      data-qa-marker-live-3b={GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3B_QA_MARKER}
      data-qa-marker-live-3c={GROWTH_HOME_OPERATOR_EXPERIENCE_LIVE_3C_QA_MARKER}
      className="space-y-4 rounded-2xl border border-border/50 bg-card/70 p-5 backdrop-blur-sm dark:border-border/40 dark:bg-card/60 sm:p-6"
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

      <div className="space-y-2" data-qa-field="home-hero-executive-briefing">
        {!compact
          ? executiveBriefing.paragraphs.map((paragraph, index) => (
              <p key={`hero-briefing:${index}`} className="text-sm leading-relaxed text-foreground">
                {paragraph}
              </p>
            ))
          : null}
      </div>

      {!compact && hero.continuousExecutiveBriefing ? (
        <GrowthHomeAvaSinceYouWereLastHereSection
          briefing={hero.continuousExecutiveBriefing}
          onAcknowledge={handleBriefingAcknowledge}
        />
      ) : null}

      {!compact ? (
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
      ) : null}
    </section>
  )
}

export { GROWTH_HOME_AVA_HERO_7A_QA_MARKER }
