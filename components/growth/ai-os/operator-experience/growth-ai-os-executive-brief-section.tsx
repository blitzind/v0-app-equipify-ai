"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { GrowthAiTeammateProfile } from "@/components/growth/ai-teammate/growth-ai-teammate-profile"
import { Button } from "@/components/ui/button"
import type { GrowthAiOsOperatorExecutiveBrief } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import { cn } from "@/lib/utils"

function healthRingClass(tone: GrowthAiOsOperatorExecutiveBrief["aiHealthTone"]) {
  if (tone === "healthy") return "text-emerald-600"
  if (tone === "attention") return "text-amber-600"
  return "text-rose-600"
}

type Props = {
  brief: GrowthAiOsOperatorExecutiveBrief
  lastUpdateLabel?: string | null
}

export function GrowthAiOsExecutiveBriefSection({ brief, lastUpdateLabel = null }: Props) {
  const teammate = resolveAiTeammatePresentation(brief.teammateName)

  return (
    <section
      data-qa-section="operator-executive-brief"
      className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-background to-background p-8 shadow-sm space-y-6"
    >
      <GrowthAiTeammateProfile
        teammate={teammate}
        statusLabel="Working"
        activityLabel="Working across AI Operations"
        lastUpdateLabel={lastUpdateLabel}
        className="border-0 bg-transparent p-0 shadow-none"
      />

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-6 max-w-2xl">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-foreground">{brief.greeting}</p>
            <p className="mt-2 text-lg text-muted-foreground">{brief.introLine}</p>
          </div>

          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Today {brief.teammateName} has
            </p>
            <ul className="mt-3 space-y-2">
              {brief.todayHighlights.map((line) => (
                <li key={line} className="flex items-start gap-2 text-base text-foreground">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-500" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <Button asChild size="lg" className="h-12 px-6 text-base">
            <Link href={brief.primaryCtaHref}>
              {brief.primaryCtaLabel}
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>

        <div className="flex shrink-0 flex-col items-center rounded-2xl border border-border/60 bg-background/80 px-10 py-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">{brief.teammateName} health</p>
          <p className={cn("mt-2 text-6xl font-bold tabular-nums tracking-tight", healthRingClass(brief.aiHealthTone))}>
            {brief.aiHealthPercent}%
          </p>
          <p className="mt-2 max-w-[12rem] text-sm text-muted-foreground">{brief.aiHealthLabel}</p>
        </div>
      </div>
    </section>
  )
}
