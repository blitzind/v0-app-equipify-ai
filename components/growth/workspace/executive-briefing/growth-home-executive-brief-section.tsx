"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { GrowthAiTeammateProfile } from "@/components/growth/ai-teammate/growth-ai-teammate-profile"
import { Button } from "@/components/ui/button"
import type { GrowthHomeExecutiveBrief } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { cn } from "@/lib/utils"

function healthAccentClass(tone: GrowthHomeExecutiveBrief["overallHealth"]["tone"]) {
  if (tone === "healthy") return "text-emerald-700 dark:text-emerald-400"
  if (tone === "attention") return "text-amber-700 dark:text-amber-400"
  return "text-rose-700 dark:text-rose-400"
}

type Props = {
  brief: GrowthHomeExecutiveBrief
  lastUpdateLabel?: string | null
}

export function GrowthHomeExecutiveBriefSection({ brief, lastUpdateLabel = null }: Props) {
  const teammate = resolveAiTeammatePresentation(brief.teammateName)

  return (
    <section
      data-qa-section="home-executive-brief"
      className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-background to-background p-6 sm:p-8 lg:p-10 shadow-sm space-y-6"
    >
      <GrowthAiTeammateProfile
        teammate={teammate}
        statusLabel="Working"
        activityLabel={brief.overallHealth.summary}
        lastUpdateLabel={lastUpdateLabel}
        className="border-0 bg-transparent p-0 shadow-none"
      />

      <div className="max-w-3xl space-y-8">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{brief.greeting}</p>
          <p className="mt-3 text-lg text-muted-foreground">{brief.introLine}</p>
        </div>

        <ul className="space-y-2.5">
          {brief.completedOutcomes.map((line) => (
            <li key={line} className="flex items-start gap-3 text-base leading-relaxed text-foreground">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-indigo-500" aria-hidden />
              {line}
            </li>
          ))}
        </ul>

        <p className="text-base font-medium text-foreground">
          {brief.exceptionCount > 0 ? brief.exceptionSummary : brief.handledRestSummary}
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {brief.meetingsBookedSummary ? (
            <div className="rounded-lg border border-border/60 bg-background/80 p-3 text-sm">{brief.meetingsBookedSummary}</div>
          ) : null}
          {brief.opportunitiesAdvancedSummary ? (
            <div className="rounded-lg border border-border/60 bg-background/80 p-3 text-sm">
              {brief.opportunitiesAdvancedSummary}
            </div>
          ) : null}
          {brief.revenueImpactSummary ? (
            <div className="rounded-lg border border-border/60 bg-background/80 p-3 text-sm">{brief.revenueImpactSummary}</div>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overall health</p>
          <p className={cn("text-lg font-semibold", healthAccentClass(brief.overallHealth.tone))}>
            {brief.overallHealth.label}
          </p>
          <p className="text-sm text-muted-foreground">{brief.overallHealth.summary}</p>
        </div>

        {brief.estimatedBusinessImpact ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sales / revenue impact</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{brief.estimatedBusinessImpact}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-border/60 pt-6">
          <Button asChild size="lg" className="h-11">
            <Link href={brief.primaryCta.href}>
              {brief.primaryCta.label}
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11">
            <Link href={brief.secondaryCta.href}>{brief.secondaryCta.label}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
