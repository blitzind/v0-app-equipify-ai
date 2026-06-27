"use client"

import Link from "next/link"
import type { GrowthHomeFeaturedOutcome } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_OWNERSHIP_BIGGEST_RISK_TITLE } from "@/lib/workspace/ai-ownership-accountability"
import { Button } from "@/components/ui/button"

type Props = {
  risk: GrowthHomeFeaturedOutcome | null
}

export function GrowthHomeBiggestRiskSection({ risk }: Props) {
  if (!risk) return null

  return (
    <section data-qa-section="home-biggest-risk" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_OWNERSHIP_BIGGEST_RISK_TITLE}</h2>
      </div>
      <article className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-6 dark:border-amber-900/40 dark:bg-amber-950/20 space-y-4">
        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
          {risk.confidenceLabel}
        </span>
        <p className="text-lg font-semibold leading-snug text-foreground">{risk.headline}</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Impact · </span>
          {risk.whyItMatters}
        </p>
        <p className="text-sm text-foreground">
          <span className="font-medium text-muted-foreground">Recommendation · </span>
          {risk.suggestedNextStep}
        </p>
        <ul className="text-sm text-muted-foreground list-disc space-y-1 pl-5">
          {risk.evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {risk.href ? (
          <Button asChild variant="outline">
            <Link href={risk.href}>Address risk</Link>
          </Button>
        ) : null}
      </article>
    </section>
  )
}
