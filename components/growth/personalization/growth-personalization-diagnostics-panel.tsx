"use client"

import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { useEffect, useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { buildGrowthBuyingStageOperatorPreview } from "@/lib/growth/buyer-journey/growth-buying-stage-engine"
import { buildPersonalizationQualityOperatorPreview } from "@/lib/growth/personalization/quality/growth-personalization-quality-engine"
import type { GrowthPersonalizationStackBDiagnosticsMetadata } from "@/lib/growth/personalization/growth-personalization-stack-b-metadata"
import {
  readPersonalizationDiagnosticsPreferences,
  persistPersonalizationDiagnosticsPreferences,
  type GrowthPersonalizationDiagnosticsSectionKey,
} from "@/lib/growth/personalization/personalization-generation-ux"
import { formatGrowthReasoningOperatorPreview } from "@/lib/growth/reasoning/growth-reasoning-diagnostics"
import { formatGrowthSequenceOperatorPreview } from "@/lib/growth/sequence-intelligence/growth-sequence-diagnostics"
import { narrativeThemeLabel } from "@/lib/growth/sequence-intelligence/growth-narrative-progression"
import { proofStageLabel } from "@/lib/growth/sequence-intelligence/growth-proof-progression"
import { ctaStageLabel } from "@/lib/growth/sequence-intelligence/growth-cta-progression"
import type { GrowthPersonalizationIndustryPlaybookDiagnostics } from "@/lib/growth/personalization/personalization-types"

function DiagnosticsCollapsibleCard({
  sectionKey,
  title,
  summary,
  open,
  onOpenChange,
  children,
}: {
  sectionKey: GrowthPersonalizationDiagnosticsSectionKey
  title: string
  summary?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="flex min-h-0 flex-col rounded-lg border border-border/60 bg-background transition-[border-color,box-shadow] data-[state=open]:border-border data-[state=open]:shadow-sm"
      data-section={sectionKey}
    >
      <CollapsibleTrigger
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <span>{title}</span>
          {summary && !open ? (
            <p className="truncate text-xs font-normal text-muted-foreground">{summary}</p>
          ) : null}
        </div>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-h-[min(240px,32vh)] overflow-y-auto px-3 pb-3 text-xs">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

type Props = {
  stackBDiagnostics?: GrowthPersonalizationStackBDiagnosticsMetadata | null
  industryPlaybookDiagnostics?: GrowthPersonalizationIndustryPlaybookDiagnostics | null
}

export function GrowthPersonalizationDiagnosticsPanel({
  stackBDiagnostics,
  industryPlaybookDiagnostics,
}: Props) {
  const [preferences, setPreferences] = useState(readPersonalizationDiagnosticsPreferences)

  useEffect(() => {
    setPreferences(readPersonalizationDiagnosticsPreferences())
  }, [])

  function setSectionOpen(section: GrowthPersonalizationDiagnosticsSectionKey, open: boolean) {
    const next = { ...preferences, [section]: open }
    setPreferences(next)
    persistPersonalizationDiagnosticsPreferences(next)
  }

  if (!stackBDiagnostics && !industryPlaybookDiagnostics) {
    return (
      <p className="text-sm text-muted-foreground">
        Generate a draft to view intelligence, quality, reasoning, and sequence guidance.
      </p>
    )
  }

  const diagnostics = stackBDiagnostics
  const reasoningPreview = diagnostics?.reasoningDiagnostics
    ? formatGrowthReasoningOperatorPreview(diagnostics.reasoningDiagnostics)
    : null
  const sequencePreview = diagnostics?.sequenceDiagnostics
    ? formatGrowthSequenceOperatorPreview(diagnostics.sequenceDiagnostics)
    : null
  const buyerJourneyPreview = diagnostics?.buyerJourneyDiagnostics
    ? buildGrowthBuyingStageOperatorPreview(diagnostics.buyerJourneyDiagnostics)
    : null
  const qualityPreview = diagnostics?.qualityDiagnostics
    ? buildPersonalizationQualityOperatorPreview(diagnostics.qualityDiagnostics)
    : null

  const intelligenceUsed = [
    diagnostics?.industryDiagnostics?.displayName
      ? `Industry: ${diagnostics.industryDiagnostics.displayName}`
      : industryPlaybookDiagnostics?.playbookDisplayName
        ? `Industry: ${industryPlaybookDiagnostics.playbookDisplayName}`
        : null,
    diagnostics?.personaDiagnostics?.persona ? `Persona: ${diagnostics.personaDiagnostics.persona}` : null,
    buyerJourneyPreview ? `Buying Stage: ${buyerJourneyPreview.buyingStageLabel}` : null,
    sequencePreview ? `Sequence: Touch ${sequencePreview.touchCount} · ${sequencePreview.sequenceLabel}` : null,
  ].filter(Boolean)

  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      <DiagnosticsCollapsibleCard
        sectionKey="intelligence"
        title="Intelligence"
        summary={intelligenceUsed[0] ?? "No intelligence recorded"}
        open={preferences.intelligence}
        onOpenChange={(open) => setSectionOpen("intelligence", open)}
      >
        {diagnostics?.stackBGeneration?.legacyFallback ? (
          <p className="mb-2 text-amber-800">Emergency legacy fallback was used.</p>
        ) : null}
        {intelligenceUsed.length ? (
          <ul className="list-none space-y-1 pl-0">
            {intelligenceUsed.map((entry) => (
              <li key={entry}>✓ {entry}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No intelligence diagnostics recorded.</p>
        )}
      </DiagnosticsCollapsibleCard>

      <DiagnosticsCollapsibleCard
        sectionKey="quality"
        title="Quality"
        summary={qualityPreview ? `Score ${qualityPreview.qualityScore}` : "Unavailable"}
        open={preferences.quality}
        onOpenChange={(open) => setSectionOpen("quality", open)}
      >
        {qualityPreview ? (
          <>
            <GrowthBadge
              label={`Score ${qualityPreview.qualityScore}`}
              tone={
                qualityPreview.qualityScore >= 80
                  ? "healthy"
                  : qualityPreview.qualityScore >= 65
                    ? "attention"
                    : "critical"
              }
            />
            {qualityPreview.strengths.length ? (
              <ul className="mt-2 list-disc pl-4">
                {qualityPreview.strengths.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            ) : null}
            {qualityPreview.suggestions.length ? (
              <ul className="mt-2 list-disc pl-4 text-muted-foreground">
                {qualityPreview.suggestions.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground">Quality pass diagnostics unavailable.</p>
        )}
      </DiagnosticsCollapsibleCard>

      <DiagnosticsCollapsibleCard
        sectionKey="reasoning"
        title="Reasoning"
        summary={reasoningPreview?.objective ?? "Unavailable"}
        open={preferences.reasoning}
        onOpenChange={(open) => setSectionOpen("reasoning", open)}
      >
        {reasoningPreview ? (
          <>
            {reasoningPreview.topInsights.length ? (
              <ul className="list-none space-y-1 pl-0">
                {reasoningPreview.topInsights.map((entry) => (
                  <li key={entry}>✓ {entry}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 font-medium">Objective: {reasoningPreview.objective}</p>
          </>
        ) : (
          <p className="text-muted-foreground">Reasoning diagnostics unavailable.</p>
        )}
      </DiagnosticsCollapsibleCard>

      <DiagnosticsCollapsibleCard
        sectionKey="sequence"
        title="Sequence"
        summary={
          sequencePreview
            ? `Touch ${sequencePreview.touchCount} · ${sequencePreview.sequenceLabel}`
            : "Unavailable"
        }
        open={preferences.sequence}
        onOpenChange={(open) => setSectionOpen("sequence", open)}
      >
        {diagnostics?.sequenceDiagnostics?.guidance ? (
          <ul className="list-none space-y-1 pl-0">
            <li>✓ Narrative: {narrativeThemeLabel(diagnostics.sequenceDiagnostics.guidance.nextNarrative)}</li>
            <li>✓ Proof: {proofStageLabel(diagnostics.sequenceDiagnostics.guidance.nextProof)}</li>
            <li>✓ CTA: {ctaStageLabel(diagnostics.sequenceDiagnostics.guidance.nextCta)}</li>
          </ul>
        ) : null}
        {sequencePreview?.avoid.length ? (
          <ul className="mt-2 list-none space-y-1 pl-0">
            {sequencePreview.avoid.map((entry) => (
              <li key={entry}>⚠ {entry}</li>
            ))}
          </ul>
        ) : null}
        {!diagnostics?.sequenceDiagnostics && !sequencePreview ? (
          <p className="text-muted-foreground">Sequence guidance unavailable.</p>
        ) : null}
      </DiagnosticsCollapsibleCard>
    </div>
  )
}
