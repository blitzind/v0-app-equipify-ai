"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, MessageSquarePlus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import {
  GROWTH_AIOS_NEXT_1A_AVA_RECOMMENDATION_HOME_QA_MARKER,
  type GrowthHomeAvaRecommendationExperience,
  type GrowthHomeAvaRecommendationItem,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"
import {
  GROWTH_AIOS_NEXT_1B_AVA_INTENT_RECOMMENDATION_QA_MARKER,
  GROWTH_HOME_AVA_ALTERNATIVE_RECOMMENDATION_INTROS,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1b-types"
import {
  recordGrowthHomeAvaRecommendationAccepted,
  recordGrowthHomeAvaRecommendationSkipped,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-preference-memory-next-1a"
import { recordGrowthHomeAvaExecutiveBriefingMeaningfulInteraction } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a"
import type { GrowthHomeAvaStrategicAdvisorContextPayload } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-context-next-1c"
import { buildGrowthHomeAvaStrategicEvaluationContext } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-context-next-1c"
import {
  evaluateGrowthHomeAvaStrategicIntent,
  buildGrowthHomeAvaStrategicOverrideIntent,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-advisor-next-1c"
import { GROWTH_AIOS_NEXT_1C_STRATEGIC_ADVISOR_QA_MARKER } from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-evaluation-next-1c-types"
import {
  GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_PLANNING_QA_MARKER,
  type GrowthHomeAvaRecommendationOutcomeProjection,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-outcome-next-1d-types"
import { GROWTH_AIOS_NEXT_1E_AVA_BUSINESS_OBJECTIVE_QA_MARKER } from "@/lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e-types"
import {
  buildStrategicMarketKey,
  readGrowthHomeAvaStrategicOverrideRecords,
  recordGrowthHomeAvaStrategicOverride,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-override-memory-next-1c"
import type { GrowthHomeAvaMissionIntentInterpretation } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1b-types"

type Props = {
  experience: GrowthHomeAvaRecommendationExperience
  organizationId?: string | null
  activeMissionLabel?: string | null
  companyCandidates?: Array<{ leadId: string; companyName: string }>
  strategicAdvisorContext?: GrowthHomeAvaStrategicAdvisorContextPayload | null
}

function displayHeadline(item: GrowthHomeAvaRecommendationItem, activeIndex: number): string {
  const headline =
    item.outcomeProjection?.outcomeHeadline ?? item.employeeHeadline ?? item.headline
  if (activeIndex === 0) return headline
  const intro =
    GROWTH_HOME_AVA_ALTERNATIVE_RECOMMENDATION_INTROS[
      Math.min(activeIndex - 1, GROWTH_HOME_AVA_ALTERNATIVE_RECOMMENDATION_INTROS.length - 1)
    ]
  const normalized = headline.replace(/^My recommendation is to /i, "").replace(/^I recommend /i, "")
  return `${intro} ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`
}

function missionHealthTone(status: GrowthHomeAvaRecommendationOutcomeProjection["missionHealth"]): string {
  if (status === "waiting_on_you") {
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
  }
  if (status === "blocked" || status === "low_confidence") {
    return "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100"
  }
  if (status === "needs_attention") {
    return "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-100"
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100"
}

function ProgressMilestones({ milestones }: { milestones: GrowthHomeAvaRecommendationOutcomeProjection["progressMilestones"] }) {
  if (milestones.length === 0) return null
  return (
    <div className="space-y-2" data-qa-field="recommendation-progress-milestones">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current progress</p>
      <div className="flex flex-wrap gap-2">
        {milestones.map((milestone) => (
          <span
            key={milestone.label}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              milestone.complete
                ? "bg-indigo-100 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {milestone.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function OutcomeDrivenDetails({ outcome }: { outcome: GrowthHomeAvaRecommendationOutcomeProjection }) {
  return (
    <div className="space-y-3" data-qa-field="recommendation-outcome-projection">
      {outcome.nextStepLabel ? (
        <p className="text-sm leading-relaxed text-foreground">{outcome.nextStepLabel}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${missionHealthTone(outcome.missionHealth)}`}
          data-qa-field="recommendation-mission-health"
        >
          Mission health · {outcome.missionHealthLabel}
        </span>
      </div>

      {outcome.currentProgressNarrative ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{outcome.currentProgressNarrative}</p>
      ) : null}

      <ProgressMilestones milestones={outcome.progressMilestones} />

      {outcome.remainingWork.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remaining work</p>
          <ul className="mt-2 space-y-1.5 text-sm text-foreground">
            {outcome.remainingWork.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {outcome.businessImpact ? (
        <p className="text-sm leading-relaxed text-foreground">
          <span className="font-medium">Business impact · </span>
          {outcome.businessImpact}
        </p>
      ) : null}
      {outcome.objectiveContext?.remainingLabel ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{outcome.objectiveContext.remainingLabel}</p>
      ) : null}
    </div>
  )
}

function ExecutionPath({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null
  return (
    <div className="space-y-2" data-qa-field="recommendation-execution-path">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What happens next</p>
      <ol className="space-y-1.5">
        {steps.map((step, index) => (
          <li key={`${step}:${index}`} className="flex items-start gap-2 text-sm text-foreground">
            <span className="min-w-0 flex-1">{step}</span>
            {index < steps.length - 1 ? (
              <span className="text-muted-foreground" aria-hidden>
                ↓
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  )
}

function StrategicEvaluationPanel({
  evaluation,
  showAlternatives,
  onShowAlternatives,
  onAcceptRecommendation,
  onProceedAnyway,
}: {
  evaluation: NonNullable<ReturnType<typeof evaluateGrowthHomeAvaStrategicIntent>>["evaluation"]
  showAlternatives: boolean
  onShowAlternatives: () => void
  onAcceptRecommendation: () => void
  onProceedAnyway: () => void
}) {
  if (!evaluation) return null

  const isStrongFit = evaluation.alignment === "strong_fit"

  return (
    <div
      className="space-y-3 rounded-md border border-indigo-200/70 bg-indigo-50/40 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20"
      data-qa-field="strategic-evaluation"
      data-qa-alignment={evaluation.alignment}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{evaluation.openingLine}</p>
        <p className="text-sm leading-relaxed text-foreground">{evaluation.perspectiveLine}</p>
      </div>

      {evaluation.supportiveReasons.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why it may fit</p>
          <ul className="mt-2 space-y-1.5 text-sm text-foreground">
            {evaluation.supportiveReasons.slice(0, 4).map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {evaluation.concernReasons.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What concerns me</p>
          <ul className="mt-2 space-y-1.5 text-sm text-foreground">
            {evaluation.concernReasons.slice(0, 5).map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {evaluation.recommendedAlternative && !isStrongFit ? (
        <p className="text-sm leading-relaxed text-foreground">
          <span className="font-medium">My recommendation · </span>
          Start with {evaluation.recommendedAlternative.label.toLowerCase()} — {evaluation.recommendedAlternative.rationale}
        </p>
      ) : null}

      {evaluation.confidenceLabel ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Confidence · </span>
          {evaluation.confidenceLabel}
        </p>
      ) : null}

      {!isStrongFit ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {evaluation.recommendedAlternative ? (
            <Button type="button" size="sm" onClick={onAcceptRecommendation}>
              Continue with my recommendation (recommended)
            </Button>
          ) : null}
          {evaluation.alternativeOptions.length > 1 && !showAlternatives ? (
            <Button type="button" size="sm" variant="outline" onClick={onShowAlternatives}>
              Show me more alternatives
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={onProceedAnyway}>
            Proceed anyway
          </Button>
        </div>
      ) : null}

      {showAlternatives && evaluation.alternativeOptions.length > 0 ? (
        <ul className="space-y-2 text-sm text-foreground" data-qa-field="strategic-alternatives">
          {evaluation.alternativeOptions.map((option) => (
            <li key={option.label} className="rounded border border-border/50 bg-background/60 p-2">
              <span className="font-medium">{option.label}</span>
              <span className="text-muted-foreground"> — {option.rationale}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function GrowthHomeAvaRecommendationExperienceSection({
  experience,
  organizationId = null,
  activeMissionLabel = null,
  companyCandidates = [],
  strategicAdvisorContext = null,
}: Props) {
  const { teammate } = useAiTeammateIdentity()
  const [activeIndex, setActiveIndex] = useState(0)
  const [showWhy, setShowWhy] = useState(false)
  const [showAssignment, setShowAssignment] = useState(false)
  const [instruction, setInstruction] = useState("")
  const [strategicPreview, setStrategicPreview] = useState<ReturnType<typeof evaluateGrowthHomeAvaStrategicIntent>>(null)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [overrideAcknowledged, setOverrideAcknowledged] = useState(false)

  const activeRecommendation = experience.recommendations[activeIndex] ?? null
  const remainingCount = Math.max(0, experience.recommendations.length - activeIndex - 1)
  const outcomeProjection = activeRecommendation?.outcomeProjection ?? null

  const strategicContext = useMemo(
    () =>
      buildGrowthHomeAvaStrategicEvaluationContext({
        payload: strategicAdvisorContext,
        overrideRecords: readGrowthHomeAvaStrategicOverrideRecords(organizationId),
      }),
    [strategicAdvisorContext, organizationId],
  )

  const resolvedIntent: GrowthHomeAvaMissionIntentInterpretation | null = useMemo(() => {
    if (!strategicPreview?.interpretation) return null
    if (overrideAcknowledged && strategicPreview.evaluation) {
      return buildGrowthHomeAvaStrategicOverrideIntent({ evaluation: strategicPreview.evaluation })
    }
    return strategicPreview.interpretation
  }, [strategicPreview, overrideAcknowledged])

  const explanation = activeRecommendation?.explanation

  const whyBullets = useMemo(() => {
    if (!activeRecommendation) return []
    if (explanation?.whyChosen.length) return explanation.whyChosen.slice(0, 5)
    return activeRecommendation.whyReasons.filter(Boolean).slice(0, 4)
  }, [activeRecommendation, explanation?.whyChosen])

  function handleContinue() {
    if (!activeRecommendation) return
    recordGrowthHomeAvaRecommendationAccepted({
      kind: activeRecommendation.kind,
      organizationId,
    })
    recordGrowthHomeAvaExecutiveBriefingMeaningfulInteraction({
      organizationId,
      kind: "recommendation_accepted",
    })
  }

  function handleSuggestAnother() {
    if (!activeRecommendation) return
    recordGrowthHomeAvaRecommendationSkipped({
      kind: activeRecommendation.kind,
      organizationId,
    })
    recordGrowthHomeAvaExecutiveBriefingMeaningfulInteraction({
      organizationId,
      kind: "recommendation_skipped",
    })
    setShowWhy(false)
    setActiveIndex((current) => Math.min(current + 1, experience.recommendations.length))
  }

  function handleIntentPreview() {
    setShowAlternatives(false)
    setOverrideAcknowledged(false)
    setStrategicPreview(
      evaluateGrowthHomeAvaStrategicIntent({
        instruction,
        companyCandidates,
        activeMissionLabel,
        context: strategicContext,
      }),
    )
  }

  function handleProceedAnyway() {
    const evaluation = strategicPreview?.evaluation
    if (!evaluation) return
    const objective = evaluation.interpretedIntent.objectiveShiftLabel ?? evaluation.interpretedIntent.understoodIntent
    const towardMatch = objective.match(/toward\s+(.+?)(?:\.|$)/i)
    const raw = towardMatch?.[1]?.trim() ?? objective
    const parts = raw.split(/\s+in\s+/i)
    const marketKey = buildStrategicMarketKey({
      industryLabel: parts[0]?.trim() || null,
      geographyLabel: parts.length >= 2 ? parts.slice(1).join(" in ").trim() : null,
    })
    recordGrowthHomeAvaStrategicOverride({
      marketKey,
      instruction,
      organizationId,
    })
    setOverrideAcknowledged(true)
  }

  function handleAcceptRecommendation() {
    const alternative = strategicPreview?.evaluation?.recommendedAlternative
    if (!alternative) return
    const geoMatch = instruction.match(/\bin\s+([A-Za-z\s]+)$/i)
    const geography = geoMatch?.[1]?.trim()
    const nextInstruction = geography
      ? `Find ${alternative.label} in ${geography}`
      : `Find ${alternative.label}`
    setInstruction(nextInstruction)
    setShowAlternatives(false)
    setOverrideAcknowledged(false)
    setStrategicPreview(
      evaluateGrowthHomeAvaStrategicIntent({
        instruction: nextInstruction,
        companyCandidates,
        activeMissionLabel,
        context: strategicContext,
      }),
    )
  }

  const canBegin =
    Boolean(resolvedIntent?.href) &&
    (!strategicPreview?.evaluation ||
      strategicPreview.evaluation.alignment === "strong_fit" ||
      overrideAcknowledged)

  if (!experience.hasRecommendations && !showAssignment) {
    return (
      <section
        data-qa-section="home-ava-recommendation-experience"
        data-qa-marker={experience.presentationQaMarker ?? GROWTH_AIOS_NEXT_1A_AVA_RECOMMENDATION_HOME_QA_MARKER}
        data-qa-marker-next-1b={GROWTH_AIOS_NEXT_1B_AVA_INTENT_RECOMMENDATION_QA_MARKER}
      data-qa-marker-next-1c={GROWTH_AIOS_NEXT_1C_STRATEGIC_ADVISOR_QA_MARKER}
      data-qa-marker-next-1d={GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_PLANNING_QA_MARKER}
      data-qa-marker-next-1e={GROWTH_AIOS_NEXT_1E_AVA_BUSINESS_OBJECTIVE_QA_MARKER}
        className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20"
      >
        <p className="text-sm text-foreground">{experience.exhaustedMessage}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setShowAssignment(true)}>
          Tell {teammate.name} what to do
        </Button>
      </section>
    )
  }

  return (
    <section
      data-qa-section="home-ava-recommendation-experience"
      data-qa-marker={experience.presentationQaMarker ?? GROWTH_AIOS_NEXT_1A_AVA_RECOMMENDATION_HOME_QA_MARKER}
      data-qa-marker-next-1b={GROWTH_AIOS_NEXT_1B_AVA_INTENT_RECOMMENDATION_QA_MARKER}
      data-qa-marker-next-1c={GROWTH_AIOS_NEXT_1C_STRATEGIC_ADVISOR_QA_MARKER}
      data-qa-marker-next-1d={GROWTH_AIOS_NEXT_1D_AVA_OUTCOME_PLANNING_QA_MARKER}
      data-qa-marker-next-1e={GROWTH_AIOS_NEXT_1E_AVA_BUSINESS_OBJECTIVE_QA_MARKER}
      className="space-y-4 rounded-xl border border-indigo-200/70 bg-indigo-50/30 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20 sm:p-5"
    >
      <div className="space-y-2">
        <p className="text-sm leading-relaxed text-muted-foreground">{experience.sinceLastVisitLine}</p>
        <p className="text-sm font-medium text-foreground">{experience.recommendationIntro}</p>
      </div>

      {activeRecommendation ? (
        <article className="space-y-4 rounded-lg border border-border/60 bg-card/80 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
            <div className="min-w-0 space-y-2">
              <p className="text-base font-semibold leading-snug text-foreground">
                {displayHeadline(activeRecommendation, activeIndex)}
              </p>
              {outcomeProjection ? (
                <OutcomeDrivenDetails outcome={outcomeProjection} />
              ) : (
                <>
                  {activeRecommendation.employeeLeadParagraph ? (
                    <p className="text-sm leading-relaxed text-foreground">{activeRecommendation.employeeLeadParagraph}</p>
                  ) : null}
                  {activeRecommendation.employeeSupportingParagraph ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {activeRecommendation.employeeSupportingParagraph}
                    </p>
                  ) : null}
                </>
              )}
              {explanation?.estimatedEffortLabel ? (
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Estimated effort · {explanation.estimatedEffortLabel}
                </p>
              ) : activeRecommendation.estimatedEffortLabel ? (
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Estimated effort · {activeRecommendation.estimatedEffortLabel}
                </p>
              ) : null}
              {explanation?.expectedOutcome ? (
                <p className="text-sm leading-relaxed text-foreground">
                  <span className="font-medium">Expected outcome · </span>
                  {explanation.expectedOutcome}
                </p>
              ) : null}
            </div>
          </div>

          <ExecutionPath steps={activeRecommendation.executionPathSteps ?? []} />

          <div className="flex flex-wrap gap-2 pt-1">
            {activeRecommendation.href ? (
              <Button asChild size="sm" onClick={handleContinue}>
                <Link href={activeRecommendation.href}>
                  Continue
                  <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
            ) : (
              <Button type="button" size="sm" disabled>
                Continue
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => setShowWhy((value) => !value)}>
              Why this recommendation?
            </Button>
            {activeIndex < experience.recommendations.length - 1 ? (
              <Button type="button" size="sm" variant="ghost" onClick={handleSuggestAnother}>
                Suggest something else
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAssignment((value) => !value)}>
              Tell {teammate.name} what to do...
            </Button>
          </div>

          {showWhy ? (
            <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-3" data-qa-field="recommendation-why">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why</p>
                <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                  {whyBullets.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span aria-hidden>•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {explanation?.expectedOutcome ? (
                <p className="text-sm text-foreground">
                  <span className="font-medium">Expected outcome · </span>
                  {explanation.expectedOutcome}
                </p>
              ) : null}
              {explanation?.estimatedEffortLabel ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Estimated effort · </span>
                  {explanation.estimatedEffortLabel}
                </p>
              ) : null}
              {explanation?.postponementRisk ? (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <span className="font-medium">Risk if postponed · </span>
                  {explanation.postponementRisk}
                </p>
              ) : null}
              {outcomeProjection?.businessImpact ? (
                <p className="text-sm text-foreground">
                  <span className="font-medium">Business impact · </span>
                  {outcomeProjection.businessImpact}
                </p>
              ) : null}
              {outcomeProjection?.missionHealthLabel ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Mission health · </span>
                  {outcomeProjection.missionHealthLabel}
                </p>
              ) : null}
              {explanation?.confidenceLabel ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Confidence · </span>
                  {explanation.confidenceLabel}
                </p>
              ) : null}
            </div>
          ) : null}

          {remainingCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              I have {remainingCount} more recommendation{remainingCount === 1 ? "" : "s"} if this isn&apos;t the right focus.
            </p>
          ) : null}
        </article>
      ) : (
        <p className="text-sm text-foreground">{experience.exhaustedMessage}</p>
      )}

      <Collapsible open={showAssignment} onOpenChange={setShowAssignment}>
        <CollapsibleContent className="space-y-3 rounded-lg border border-border/60 bg-card/70 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageSquarePlus className="size-4" aria-hidden />
            Tell {teammate.name} what to do
          </div>
          <Textarea
            value={instruction}
            onChange={(event) => {
              setInstruction(event.target.value)
              setStrategicPreview(null)
              setOverrideAcknowledged(false)
              setShowAlternatives(false)
            }}
            placeholder="What would you like me to do?"
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleIntentPreview}>
              Preview my plan
            </Button>
            {canBegin && resolvedIntent?.href ? (
              <Button asChild size="sm">
                <Link href={resolvedIntent.href}>Begin</Link>
              </Button>
            ) : null}
          </div>
          {strategicPreview?.evaluation ? (
            <StrategicEvaluationPanel
              evaluation={strategicPreview.evaluation}
              showAlternatives={showAlternatives}
              onShowAlternatives={() => setShowAlternatives(true)}
              onAcceptRecommendation={handleAcceptRecommendation}
              onProceedAnyway={handleProceedAnyway}
            />
          ) : null}
          {resolvedIntent ? (
            <div className="space-y-3 rounded-md border border-border/50 bg-muted/20 p-3 text-sm">
              <p className="font-medium text-foreground">{resolvedIntent.restatement}</p>
              {resolvedIntent.objectiveShiftLabel ? (
                <p className="text-foreground">{resolvedIntent.objectiveShiftLabel}</p>
              ) : null}
              <p className="text-muted-foreground">{resolvedIntent.planSummary}</p>
              {resolvedIntent.beforeBeginSteps.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Before I begin I will
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {resolvedIntent.beforeBeginSteps.map((step) => (
                      <li key={step} className="flex gap-2">
                        <span aria-hidden>•</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {resolvedIntent.expectedOutcome ? (
                <p className="text-foreground">
                  <span className="font-medium">Expected outcome · </span>
                  {resolvedIntent.expectedOutcome}
                </p>
              ) : null}
              {resolvedIntent.estimatedEffortLabel ? (
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Estimated effort · {resolvedIntent.estimatedEffortLabel}
                </p>
              ) : null}
              {resolvedIntent.requiresConfirmation && !overrideAcknowledged && strategicPreview?.evaluation?.alignment !== "strong_fit" ? (
                <p className="text-sm font-medium text-foreground">
                  Review my strategic read above, then choose how you&apos;d like to proceed.
                </p>
              ) : resolvedIntent.requiresConfirmation ? (
                <p className="text-sm font-medium text-foreground">Would you like me to begin?</p>
              ) : null}
              {resolvedIntent.conflictNote ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">{resolvedIntent.conflictNote}</p>
              ) : null}
            </div>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}
