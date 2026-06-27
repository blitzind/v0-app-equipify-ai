"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import type { GrowthHomeInitiativeRecommendation } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  AI_INITIATIVE_RECOMMENDATION_CATEGORIES,
  AI_PROACTIVE_RECOMMENDATIONS_TITLE,
} from "@/lib/workspace/ai-proactive-initiative"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

type Props = {
  recommendations: GrowthHomeInitiativeRecommendation[]
}

function RecommendationCard({ recommendation, featured }: { recommendation: GrowthHomeInitiativeRecommendation; featured?: boolean }) {
  return (
    <article
      className={cn(
        "rounded-xl border p-5",
        featured ? "border-indigo-100 bg-indigo-50/40 dark:border-indigo-900/40 dark:bg-indigo-950/20" : "border-border/70 bg-card",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {recommendation.priorityLabel}
        </span>
        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
          {recommendation.confidenceLabel}
        </span>
      </div>
      <h3 className={cn("mt-3 font-semibold leading-snug text-foreground", featured ? "text-lg" : "text-base")}>
        {recommendation.headline}
      </h3>
      <div className="mt-4 space-y-2 text-sm">
        <p>
          <span className="font-medium text-muted-foreground">Why it matters · </span>
          {recommendation.whyItMatters}
        </p>
        <p>
          <span className="font-medium text-muted-foreground">Recommended action · </span>
          {recommendation.recommendedAction}
        </p>
        <div>
          <p className="font-medium text-muted-foreground">Evidence</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            {recommendation.evidence.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
      <Button asChild className="mt-4" size={featured ? "default" : "sm"}>
        <Link href={recommendation.primaryCtaHref}>{recommendation.primaryCtaLabel}</Link>
      </Button>
    </article>
  )
}

export function GrowthHomeInitiativeRecommendationsSection({ recommendations }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (recommendations.length === 0) return null

  const primary = recommendations[0]
  const additional = recommendations.slice(1)
  const grouped = AI_INITIATIVE_RECOMMENDATION_CATEGORIES.map((category) => ({
    ...category,
    items: recommendations.filter((row) => row.category === category.id),
  })).filter((group) => group.items.length > 0)

  return (
    <section data-qa-section="home-initiative-recommendations" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{AI_PROACTIVE_RECOMMENDATIONS_TITLE}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Every suggestion includes why it matters and supporting evidence.</p>
      </div>

      {primary ? <RecommendationCard recommendation={primary} featured /> : null}

      {grouped.length > 1 ? (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="gap-2 px-0 text-muted-foreground hover:text-foreground">
              <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              {expanded ? "Hide grouped recommendations" : "Show recommendations by category"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-6 pt-4">
            {grouped.map((group) => (
              <div key={group.id}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                <div className="mt-3 space-y-3">
                  {group.items.map((row) => (
                    <RecommendationCard key={row.id} recommendation={row} />
                  ))}
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : additional.length > 0 ? (
        <div className="space-y-3">
          {additional.map((row) => (
            <RecommendationCard key={row.id} recommendation={row} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
