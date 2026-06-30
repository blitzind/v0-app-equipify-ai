"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { AI_OS_TOP_BUSINESS_MOVE_TITLE } from "@/lib/workspace/ai-os-outcome-first-terminology"
import { GROWTH_AVA_RECOMMENDS_NEXT_COPY } from "@/lib/growth/workspace/growth-workspace-ava-identity"
import type { GrowthHomeRecommendation } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

type Props = {
  recommendation: GrowthHomeRecommendation | null
  additionalRecommendations: GrowthHomeRecommendation[]
}

function RecommendationArticle({ recommendation, featured }: { recommendation: GrowthHomeRecommendation; featured?: boolean }) {
  return (
    <article
      className={
        featured
          ? "rounded-2xl border border-indigo-100 bg-indigo-50/40 p-6 dark:border-indigo-900/40 dark:bg-indigo-950/20"
          : "rounded-xl border border-border/70 bg-card p-4"
      }
    >
      <div className="flex items-start gap-3">
        {featured ? <Sparkles className="mt-1 size-5 shrink-0 text-indigo-600" aria-hidden /> : null}
        <div className="flex-1 space-y-4">
          <div>
            <h3 className={featured ? "text-xl font-semibold" : "text-base font-semibold"}>{recommendation.headline}</h3>
            {recommendation.estimatedRevenue ? (
              <p className="mt-1 text-sm font-medium text-indigo-800 dark:text-indigo-300">
                Expected opportunity value · {recommendation.estimatedRevenue}
              </p>
            ) : null}
          </div>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium text-muted-foreground">Why this matters · </span>
              {recommendation.whyItMatters}
            </p>
            <p>
              <span className="font-medium text-muted-foreground">Expected impact · </span>
              {recommendation.expectedImpact}
            </p>
            <p>
              <span className="font-medium text-muted-foreground">Time required · </span>
              {recommendation.timeRequired}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size={featured ? "default" : "sm"}>
              <Link href={recommendation.primaryCtaHref}>{recommendation.primaryCtaLabel}</Link>
            </Button>
            <Button variant="ghost" type="button" size={featured ? "default" : "sm"} disabled>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}

export function GrowthHomeRecommendationCard({ recommendation, additionalRecommendations }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!recommendation) return null

  return (
    <section data-qa-section="home-recommendation" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_OS_TOP_BUSINESS_MOVE_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{GROWTH_AVA_RECOMMENDS_NEXT_COPY}</p>
      </div>

      <RecommendationArticle recommendation={recommendation} featured />

      {additionalRecommendations.length > 0 ? (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="gap-2 px-0 text-muted-foreground hover:text-foreground">
              <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              {expanded
                ? "Hide additional recommendations"
                : `Show ${additionalRecommendations.length} more recommendation${additionalRecommendations.length === 1 ? "" : "s"}`}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            {additionalRecommendations.map((row) => (
              <RecommendationArticle key={row.id} recommendation={row} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  )
}
