"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { buildGrowthBuyingStageOperatorPreview } from "@/lib/growth/buyer-journey/growth-buying-stage-engine"
import { buildPersonalizationQualityOperatorPreview } from "@/lib/growth/personalization/quality/growth-personalization-quality-engine"
import type { GrowthPersonalizationStackBDiagnosticsMetadata } from "@/lib/growth/personalization/growth-personalization-stack-b-metadata"
import { formatGrowthReasoningOperatorPreview } from "@/lib/growth/reasoning/growth-reasoning-diagnostics"
import { formatGrowthSequenceOperatorPreview } from "@/lib/growth/sequence-intelligence/growth-sequence-diagnostics"
import { narrativeThemeLabel } from "@/lib/growth/sequence-intelligence/growth-narrative-progression"
import { proofStageLabel } from "@/lib/growth/sequence-intelligence/growth-proof-progression"
import { ctaStageLabel } from "@/lib/growth/sequence-intelligence/growth-cta-progression"

type Props = {
  diagnostics: GrowthPersonalizationStackBDiagnosticsMetadata
}

export function GrowthPersonalizationStackBPreview({ diagnostics }: Props) {
  const reasoningPreview = diagnostics.reasoningDiagnostics
    ? formatGrowthReasoningOperatorPreview(diagnostics.reasoningDiagnostics)
    : null
  const sequencePreview = diagnostics.sequenceDiagnostics
    ? formatGrowthSequenceOperatorPreview(diagnostics.sequenceDiagnostics)
    : null
  const buyerJourneyPreview = diagnostics.buyerJourneyDiagnostics
    ? buildGrowthBuyingStageOperatorPreview(diagnostics.buyerJourneyDiagnostics)
    : null
  const qualityPreview = diagnostics.qualityDiagnostics
    ? buildPersonalizationQualityOperatorPreview(diagnostics.qualityDiagnostics)
    : null

  const intelligenceUsed = [
    diagnostics.industryDiagnostics?.displayName
      ? `Industry: ${diagnostics.industryDiagnostics.displayName}`
      : null,
    diagnostics.personaDiagnostics?.persona ? `Persona: ${diagnostics.personaDiagnostics.persona}` : null,
    buyerJourneyPreview ? `Buying Stage: ${buyerJourneyPreview.buyingStageLabel}` : null,
    sequencePreview ? `Sequence: Touch ${sequencePreview.touchCount} · ${sequencePreview.sequenceLabel}` : null,
  ].filter(Boolean)

  return (
    <div className="space-y-3">
      {diagnostics.stackBGeneration?.legacyFallback ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-950">
          Emergency legacy fallback was used — Stack B generation did not complete.
        </div>
      ) : null}

      {intelligenceUsed.length > 0 ? (
        <div className="rounded-md border border-border bg-background px-3 py-2 text-xs">
          <p className="font-medium">Intelligence Used</p>
          <ul className="mt-1 list-none pl-0">
            {intelligenceUsed.map((entry) => (
              <li key={entry}>✓ {entry}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {reasoningPreview ? (
        <div className="rounded-md border border-border bg-background px-3 py-2 text-xs">
          <p className="font-medium">Reasoning</p>
          {reasoningPreview.topInsights.length > 0 ? (
            <div className="mt-2">
              <p className="text-muted-foreground">Top Insights</p>
              <ul className="mt-1 list-none pl-0">
                {reasoningPreview.topInsights.map((entry) => (
                  <li key={entry}>✓ {entry}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {reasoningPreview.recommendedApproach.length > 0 ? (
            <div className="mt-2">
              <p className="text-muted-foreground">Recommended Approach</p>
              <ul className="mt-1 list-disc pl-4">
                {reasoningPreview.recommendedApproach.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-2 font-medium">Objective: {reasoningPreview.objective}</p>
        </div>
      ) : null}

      {sequencePreview || diagnostics.sequenceDiagnostics?.guidance ? (
        <div className="rounded-md border border-border bg-background px-3 py-2 text-xs">
          <p className="font-medium">Sequence Guidance</p>
          {diagnostics.sequenceDiagnostics?.guidance ? (
            <ul className="mt-1 list-none pl-0">
              <li>✓ Narrative: {narrativeThemeLabel(diagnostics.sequenceDiagnostics.guidance.nextNarrative)}</li>
              <li>✓ Proof: {proofStageLabel(diagnostics.sequenceDiagnostics.guidance.nextProof)}</li>
              <li>✓ CTA: {ctaStageLabel(diagnostics.sequenceDiagnostics.guidance.nextCta)}</li>
            </ul>
          ) : null}
          {sequencePreview?.avoid.length ? (
            <div className="mt-2">
              <p className="text-muted-foreground">Avoid Patterns</p>
              <ul className="mt-1 list-none pl-0">
                {sequencePreview.avoid.map((entry) => (
                  <li key={entry}>⚠ {entry}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {sequencePreview ? (
            <p className="mt-2 text-muted-foreground">
              Fatigue: {sequencePreview.fatigueLabel} · Engagement: {sequencePreview.engagementLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      {qualityPreview ? (
        <div className="rounded-md border border-border bg-background px-3 py-2 text-xs">
          <p className="font-medium">Quality</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <GrowthBadge
              label={`Score ${qualityPreview.qualityScore}`}
              tone={qualityPreview.qualityScore >= 80 ? "healthy" : qualityPreview.qualityScore >= 65 ? "attention" : "critical"}
            />
          </div>
          {qualityPreview.strengths.length > 0 ? (
            <div className="mt-2">
              <p className="text-muted-foreground">Strengths</p>
              <ul className="mt-1 list-disc pl-4">
                {qualityPreview.strengths.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {qualityPreview.suggestions.length > 0 ? (
            <div className="mt-2">
              <p className="text-muted-foreground">Suggestions</p>
              <ul className="mt-1 list-disc pl-4">
                {qualityPreview.suggestions.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
