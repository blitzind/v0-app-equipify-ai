"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { GrowthAiOsRevenueDirectorSection } from "@/components/growth/ai-os/command-center/growth-ai-os-revenue-director-section"
import { AI_OS_TOP_BUSINESS_MOVE_TITLE } from "@/lib/workspace/ai-os-outcome-first-terminology"
import type { GrowthRevenueDirectorReadModel } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import { GROWTH_AVA_RECOMMENDS_OUTCOME_COPY } from "@/lib/growth/workspace/growth-workspace-ava-identity"
import type { GrowthAiOsOperatorRevenueRecommendation } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"

type Props = {
  recommendation: GrowthAiOsOperatorRevenueRecommendation | null
  revenueDirector?: GrowthRevenueDirectorReadModel
}

export function GrowthAiOsOperatorRevenueDirectorCard({ recommendation, revenueDirector }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!recommendation) return null

  return (
    <section id="top-business-move" data-qa-section="operator-top-business-move" className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{AI_OS_TOP_BUSINESS_MOVE_TITLE}</h2>
        <p className="mt-1 text-muted-foreground">{GROWTH_AVA_RECOMMENDS_OUTCOME_COPY}</p>
      </div>

      <article className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-6">
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-1 size-5 text-indigo-600" aria-hidden />
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-xl font-semibold">{recommendation.headline}</h3>
              {recommendation.estimatedValue ? (
                <p className="mt-1 text-sm font-medium text-indigo-800">
                  Estimated value · {recommendation.estimatedValue}
                </p>
              ) : null}
            </div>

            {recommendation.reasons.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reason</p>
                <ul className="mt-2 space-y-1">
                  {recommendation.reasons.map((reason) => (
                    <li key={reason} className="text-base text-foreground">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {recommendation.reviewHref ? (
                <Button asChild>
                  <Link href={recommendation.reviewHref}>Review Recommendation</Link>
                </Button>
              ) : null}
              <Button variant="ghost" type="button" disabled>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </article>

      {revenueDirector ? (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="gap-2 px-0 text-muted-foreground hover:text-foreground">
              <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              {expanded ? "Hide details" : "Show more details"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <GrowthAiOsRevenueDirectorSection revenueDirector={revenueDirector} />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  )
}
