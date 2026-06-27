"use client"

import Link from "next/link"
import type { GrowthHomeFeaturedOutcome } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_OWNERSHIP_BIGGEST_WIN_TITLE } from "@/lib/workspace/ai-ownership-accountability"
import { Button } from "@/components/ui/button"

type Props = {
  win: GrowthHomeFeaturedOutcome | null
}

export function GrowthHomeBiggestWinSection({ win }: Props) {
  if (!win) return null

  return (
    <section data-qa-section="home-biggest-win" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_OWNERSHIP_BIGGEST_WIN_TITLE}</h2>
      </div>
      <article className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-6 dark:border-emerald-900/40 dark:bg-emerald-950/20 space-y-4">
        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          {win.confidenceLabel}
        </span>
        <p className="text-lg font-semibold leading-snug text-foreground">{win.headline}</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Why it matters · </span>
          {win.whyItMatters}
        </p>
        <p className="text-sm text-foreground">
          <span className="font-medium text-muted-foreground">Suggested next step · </span>
          {win.suggestedNextStep}
        </p>
        <ul className="text-sm text-muted-foreground list-disc space-y-1 pl-5">
          {win.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {win.href ? (
          <Button asChild variant="outline">
            <Link href={win.href}>Take next step</Link>
          </Button>
        ) : null}
      </article>
    </section>
  )
}
