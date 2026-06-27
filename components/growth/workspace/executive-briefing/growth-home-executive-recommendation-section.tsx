"use client"

import Link from "next/link"
import type { GrowthHomeExecutiveRecommendation } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_OWNERSHIP_EXECUTIVE_REC_TITLE } from "@/lib/workspace/ai-ownership-accountability"
import { Button } from "@/components/ui/button"

type Props = {
  recommendation: GrowthHomeExecutiveRecommendation | null
}

export function GrowthHomeExecutiveRecommendationSection({ recommendation }: Props) {
  if (!recommendation) return null

  return (
    <section
      data-qa-section="home-executive-recommendation"
      className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-6 dark:border-indigo-900/40 dark:bg-indigo-950/20 space-y-4"
    >
      <h2 className="text-lg font-semibold tracking-tight">{AI_OWNERSHIP_EXECUTIVE_REC_TITLE}</h2>
      <p className="text-base leading-relaxed text-foreground">{recommendation.sentence}</p>
      <ul className="text-sm text-muted-foreground list-disc space-y-1 pl-5">
        {recommendation.evidence.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {recommendation.href ? (
        <Button asChild>
          <Link href={recommendation.href}>Act on recommendation</Link>
        </Button>
      ) : null}
    </section>
  )
}
