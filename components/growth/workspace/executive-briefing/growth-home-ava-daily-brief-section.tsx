"use client"

import Link from "next/link"
import { ArrowRight, Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { Button } from "@/components/ui/button"
import {
  GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER,
  type GrowthHomeDailyBriefPresentation,
} from "@/lib/growth/home/growth-home-simplification-1a"
import type { GrowthHomeReviewQueueDailyBrief } from "@/lib/growth/home/growth-home-review-queue-1b"
import type { GrowthHomeAvaHeroViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a"

type Props = {
  hero: GrowthHomeAvaHeroViewModel
  dailyBrief: GrowthHomeDailyBriefPresentation
  queueBrief?: GrowthHomeReviewQueueDailyBrief | null
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

export function GrowthHomeAvaDailyBriefSection({
  hero,
  dailyBrief,
  queueBrief = null,
  lastUpdateLabel = null,
}: Props) {
  const { teammate } = useAiTeammateIdentity()
  const useQueueBrief = Boolean(queueBrief?.packagesPreparedLine || queueBrief?.accomplishmentLine)
  const primaryHref = queueBrief?.primaryActionHref ?? dailyBrief.primaryActionHref
  const primaryLabel = queueBrief?.primaryActionLabel ?? dailyBrief.primaryActionLabel

  return (
    <section
      data-qa-section="home-ava-daily-brief"
      data-qa-marker-simplification-1a={GROWTH_HOME_SIMPLIFICATION_1A_QA_MARKER}
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

      <div className="space-y-3" data-qa-field="home-daily-brief-body">
        {useQueueBrief && queueBrief ? (
          <>
            {queueBrief.accomplishmentLine ? (
              <p className="text-sm leading-relaxed text-foreground">{queueBrief.accomplishmentLine}</p>
            ) : null}
            {queueBrief.packagesPreparedLine ? (
              <p className="text-sm leading-relaxed text-foreground">{queueBrief.packagesPreparedLine}</p>
            ) : null}
            {queueBrief.recommendSendLine ? (
              <p className="text-sm leading-relaxed text-foreground">{queueBrief.recommendSendLine}</p>
            ) : null}
            {queueBrief.needsAdditionalReviewLine ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{queueBrief.needsAdditionalReviewLine}</p>
            ) : null}
          </>
        ) : (
          <>
        {dailyBrief.accomplishmentLine ? (
          <p className="text-sm leading-relaxed text-foreground">{dailyBrief.accomplishmentLine}</p>
        ) : null}
        {dailyBrief.opportunityLine ? (
          <p className="text-sm leading-relaxed text-foreground">{dailyBrief.opportunityLine}</p>
        ) : null}
        {dailyBrief.companyName && dailyBrief.fitBullets.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {dailyBrief.companyName} is a strong fit because:
            </p>
            <ul className="space-y-1.5 text-sm text-foreground">
              {dailyBrief.fitBullets.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {dailyBrief.recommendationLine ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">My recommendation</p>
            <p className="text-sm font-medium text-foreground">{dailyBrief.recommendationLine}</p>
          </div>
        ) : null}
        {dailyBrief.whatHappensNextLine ? (
          <p className="text-sm text-muted-foreground">{dailyBrief.whatHappensNextLine}</p>
        ) : null}
          </>
        )}
      </div>

      {primaryHref ? (
        <Button asChild size="default" className="w-full sm:w-auto">
          <Link href={primaryHref}>
            {primaryLabel}
            <ArrowRight className="ml-1.5 size-4" aria-hidden />
          </Link>
        </Button>
      ) : null}
    </section>
  )
}
