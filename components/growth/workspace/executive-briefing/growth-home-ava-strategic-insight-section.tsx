"use client"

import { useState } from "react"
import Link from "next/link"
import { Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_AIOS_NEXT_1F_AVA_STRATEGIC_LEADERSHIP_QA_MARKER,
  type GrowthHomeAvaStrategicLeadershipPayload,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-leadership-next-1f-types"

type Props = {
  leadership: GrowthHomeAvaStrategicLeadershipPayload
  onContinueCurrentObjective?: () => void
}

function confidenceLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function GrowthHomeAvaStrategicInsightSection({
  leadership,
  onContinueCurrentObjective,
}: Props) {
  const [showReview, setShowReview] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (!leadership.hasInsight || !leadership.insight || dismissed) return null

  const recommendation = leadership.recommendation

  return (
    <section
      data-qa-section="home-ava-strategic-insight"
      data-qa-marker={GROWTH_AIOS_NEXT_1F_AVA_STRATEGIC_LEADERSHIP_QA_MARKER}
      data-qa-insight-kind={leadership.insight.kind}
      className="space-y-4 rounded-xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/40 dark:bg-violet-950/20 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-violet-700 dark:text-violet-200" aria-hidden />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {leadership.title}
            </p>
            <p className="text-sm font-medium text-foreground">{leadership.subtitle}</p>
          </div>

          <p className="text-sm leading-relaxed text-foreground">{leadership.insight.observation}</p>
          {leadership.executiveReasoning?.primary?.evidence?.length ? (
            <div data-qa-field="executive-reasoning-evidence">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</p>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                {leadership.executiveReasoning.primary.evidence.slice(0, 4).map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {leadership.executiveReasoning?.primary?.alternativeExplanations?.[0] ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Alternative explanation · </span>
              {leadership.executiveReasoning.primary.alternativeExplanations[0]}
            </p>
          ) : null}
          <p className="text-sm leading-relaxed text-muted-foreground">{leadership.insight.whyItMatters}</p>

          {leadership.insight.strategicMemoryLine ? (
            <p className="text-sm leading-relaxed text-foreground">{leadership.insight.strategicMemoryLine}</p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Confidence · </span>
            {confidenceLabel(leadership.insight.confidence)} — {leadership.insight.confidenceReason}
          </p>

          {recommendation ? (
            <div className="space-y-3 rounded-lg border border-border/50 bg-background/70 p-3">
              <p className="text-sm font-semibold text-foreground">{recommendation.headline}</p>
              <p className="text-sm leading-relaxed text-foreground">{recommendation.summary}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDismissed(true)
                    onContinueCurrentObjective?.()
                  }}
                >
                  Continue with current objective
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowReview((value) => !value)}>
                  Review Ava&apos;s recommendation
                </Button>
                <Button asChild size="sm">
                  <Link href={recommendation.objectivesReviewHref}>Adopt recommended objective</Link>
                </Button>
              </div>
            </div>
          ) : null}

          {showReview && recommendation ? (
            <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3" data-qa-field="strategic-review">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What I observed</p>
                <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                  {recommendation.whatObserved.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span aria-hidden>•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-foreground">
                <span className="font-medium">Why it matters · </span>
                {recommendation.whyItMatters}
              </p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Supporting evidence</p>
                <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                  {recommendation.supportingEvidence.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span aria-hidden>•</span>
                      <span>{line.replace(/_/g, " ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-sm text-foreground">
                <span className="font-medium">Expected impact · </span>
                {recommendation.expectedImpact}
              </p>
              {recommendation.estimatedBenefit ? (
                <p className="text-sm text-foreground">
                  <span className="font-medium">Estimated benefit · </span>
                  {recommendation.estimatedBenefit}
                </p>
              ) : null}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Potential risks</p>
                <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                  {recommendation.potentialRisks.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span aria-hidden>•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What would change</p>
                <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                  {recommendation.whatWouldChange.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span aria-hidden>•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What would remain the same</p>
                <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                  {recommendation.whatRemainsTheSame.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span aria-hidden>•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Confidence · </span>
                {confidenceLabel(recommendation.confidence)} — {recommendation.confidenceReason}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
