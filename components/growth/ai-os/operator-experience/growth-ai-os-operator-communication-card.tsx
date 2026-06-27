"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { GrowthAiOsCommunicationEngineSection } from "@/components/growth/ai-os/command-center/growth-ai-os-communication-engine-section"
import type { GrowthAiOsOperatorOutreachRecommendation } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"
import type { GrowthCommunicationEngineReadModel } from "@/lib/growth/aios/communication/growth-communication-engine-types"

type Props = {
  recommendation: GrowthAiOsOperatorOutreachRecommendation | null
  communicationEngine?: GrowthCommunicationEngineReadModel
}

export function GrowthAiOsOperatorCommunicationCard({ recommendation, communicationEngine }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!recommendation) return null

  return (
    <section data-qa-section="operator-communication" className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Recommended Outreach</h2>
        <p className="mt-1 text-muted-foreground">Channel strategy without implementation noise.</p>
      </div>

      <article className="rounded-2xl border border-border/70 bg-card p-6">
        <div className="flex items-start gap-3">
          <Mail className="mt-1 size-5 text-indigo-600" aria-hidden />
          <div className="flex-1 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Primary</p>
                <p className="text-xl font-semibold capitalize">{recommendation.primaryChannel}</p>
              </div>
              {recommendation.secondaryChannel ? (
                <div>
                  <p className="text-sm text-muted-foreground">Secondary</p>
                  <p className="text-xl font-semibold capitalize">{recommendation.secondaryChannel}</p>
                </div>
              ) : null}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Reason</p>
              <p className="mt-1 text-base">{recommendation.reason}</p>
            </div>
            {recommendation.draftHref ? (
              <Button asChild variant="outline">
                <Link href={recommendation.draftHref}>Generate Draft</Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Generate Draft
              </Button>
            )}
          </div>
        </div>
      </article>

      {communicationEngine && recommendation.evidenceAvailable ? (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="gap-2 px-0 text-muted-foreground hover:text-foreground">
              <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
              {expanded ? "Hide channel evidence" : "Show channel evidence"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <GrowthAiOsCommunicationEngineSection communicationEngine={communicationEngine} />
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  )
}
