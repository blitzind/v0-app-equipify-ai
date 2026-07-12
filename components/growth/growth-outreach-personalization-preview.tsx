"use client"

import { AlertTriangle } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { outreachIndustryLabel } from "@/lib/growth/outreach/personalization/industry-detection"
import type { OutreachPersonalizationAudit } from "@/lib/growth/outreach/personalization/personalization-types"
import { buildPersonalizationQualityOperatorPreview } from "@/lib/growth/personalization/quality/growth-personalization-quality-engine"
import { buildGrowthPlaybookOutcomeOperatorPreview } from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-engine"
import { buildGrowthBuyingStageOperatorPreview } from "@/lib/growth/buyer-journey/growth-buying-stage-engine"
import { formatGrowthReasoningOperatorPreview } from "@/lib/growth/reasoning/growth-reasoning-diagnostics"
import { formatGrowthSequenceOperatorPreview } from "@/lib/growth/sequence-intelligence/growth-sequence-diagnostics"
import { GrowthOutboundSenderContextBadge } from "@/components/growth/signatures/growth-outbound-sender-context-badge"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"

type Props = {
  audit: OutreachPersonalizationAudit
  generatedSubject?: string | null
  generatedContent: string
  outboundIdentity?: {
    displayName?: string | null
    title?: string | null
  } | null
}

function confidenceTone(label: OutreachPersonalizationAudit["confidenceLabel"]): "healthy" | "attention" | "critical" {
  if (label === "high") return "healthy"
  if (label === "medium") return "attention"
  return "critical"
}

function warningTone(severity: OutreachPersonalizationAudit["warnings"][number]["severity"]): "neutral" | "attention" | "critical" {
  if (severity === "critical") return "critical"
  if (severity === "warning") return "attention"
  return "neutral"
}

export function GrowthOutreachPersonalizationPreview({ audit, generatedSubject, generatedContent, outboundIdentity }: Props) {
  const { teammate } = useAiTeammateIdentity()
  const qualityPreview = audit.qualityDiagnostics
    ? buildPersonalizationQualityOperatorPreview(audit.qualityDiagnostics)
    : null
  const outcomePreview = audit.outcomeGuidanceDiagnostics
    ? buildGrowthPlaybookOutcomeOperatorPreview(audit.outcomeGuidanceDiagnostics)
    : null
  const buyerJourneyPreview = audit.buyerJourneyDiagnostics
    ? buildGrowthBuyingStageOperatorPreview(audit.buyerJourneyDiagnostics)
    : null
  const reasoningPreview = audit.reasoningDiagnostics
    ? formatGrowthReasoningOperatorPreview(audit.reasoningDiagnostics)
    : null
  const sequencePreview = audit.sequenceDiagnostics
    ? formatGrowthSequenceOperatorPreview(audit.sequenceDiagnostics)
    : null

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <GrowthOutboundSenderContextBadge identity={outboundIdentity} />
        <GrowthBadge label={`Confidence ${audit.confidenceScore}`} tone={confidenceTone(audit.confidenceLabel)} />
        {qualityPreview ? (
          <GrowthBadge label={`Quality ${qualityPreview.qualityScore}`} tone={qualityPreview.qualityScore >= 80 ? "healthy" : qualityPreview.qualityScore >= 65 ? "attention" : "critical"} />
        ) : null}
        <GrowthBadge label={audit.strategyVersion} tone="neutral" />
        <GrowthBadge label={outreachIndustryLabel(audit.industry)} tone="neutral" />
        <GrowthBadge label={audit.angle.replace(/_/g, " ")} tone="neutral" />
        {audit.qualityApplied ? (
          <GrowthBadge label="Quality pass applied" tone="healthy" />
        ) : null}
        {audit.outcomeGuidanceApplied ? (
          <GrowthBadge label="Outcome guidance applied" tone="healthy" />
        ) : null}
        {audit.buyerJourneyApplied ? (
          <GrowthBadge label="Buying stage applied" tone="healthy" />
        ) : null}
        {audit.reasoningApplied ? (
          <GrowthBadge label="Reasoning plan applied" tone="healthy" />
        ) : null}
        {audit.sequenceGuidanceApplied ? (
          <GrowthBadge label="Sequence guidance applied" tone="healthy" />
        ) : null}
        {audit.refinedByAi ? (
          <GrowthBadge label={`Refined by ${teammate.name}`} tone="healthy" />
        ) : (
          <GrowthBadge label="Draft preview" tone="neutral" />
        )}
      </div>

      {qualityPreview ? (
        <div className="rounded-md border border-border bg-background px-3 py-2 text-xs">
          <p className="font-medium">Quality Score: {qualityPreview.qualityScore}</p>
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

      {outcomePreview ? (
        <div className="rounded-md border border-border bg-background px-3 py-2 text-xs">
          <p className="font-medium">Winning Patterns</p>
          {outcomePreview.winningPatterns.length > 0 ? (
            <ul className="mt-1 list-none pl-0">
              {outcomePreview.winningPatterns.map((entry) => (
                <li key={entry}>✓ {entry}</li>
              ))}
            </ul>
          ) : null}
          {outcomePreview.avoidPatterns.length > 0 ? (
            <div className="mt-2">
              <p className="text-muted-foreground">Avoid</p>
              <ul className="mt-1 list-none pl-0">
                {outcomePreview.avoidPatterns.map((entry) => (
                  <li key={entry}>⚠ {entry}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-2 text-muted-foreground">
            Confidence: {outcomePreview.confidenceLabel} · {outcomePreview.sampleSize} samples · {outcomePreview.freshnessDays} days
          </p>
        </div>
      ) : null}

      {reasoningPreview ? (
        <div className="rounded-md border border-border bg-background px-3 py-2 text-xs">
          <p className="font-medium">Top Insights</p>
          {reasoningPreview.topInsights.length > 0 ? (
            <ul className="mt-1 list-none pl-0">
              {reasoningPreview.topInsights.map((entry) => (
                <li key={entry}>✓ {entry}</li>
              ))}
            </ul>
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

      {sequencePreview ? (
        <div className="rounded-md border border-border bg-background px-3 py-2 text-xs">
          <p className="font-medium">
            Sequence: Touch {sequencePreview.touchCount} · {sequencePreview.sequenceLabel}
          </p>
          {sequencePreview.narrativeUsed.length > 0 ? (
            <div className="mt-2">
              <p className="text-muted-foreground">Narrative Used</p>
              <ul className="mt-1 list-none pl-0">
                {sequencePreview.narrativeUsed.map((entry) => (
                  <li key={entry}>✓ {entry}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {sequencePreview.recommended.length > 0 ? (
            <div className="mt-2">
              <p className="text-muted-foreground">Recommended</p>
              <ul className="mt-1 list-none pl-0">
                {sequencePreview.recommended.map((entry) => (
                  <li key={entry}>✓ {entry}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {sequencePreview.avoid.length > 0 ? (
            <div className="mt-2">
              <p className="text-muted-foreground">Avoid</p>
              <ul className="mt-1 list-none pl-0">
                {sequencePreview.avoid.map((entry) => (
                  <li key={entry}>⚠ {entry}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-2">
            Fatigue: {sequencePreview.fatigueLabel} · Engagement: {sequencePreview.engagementLabel}
          </p>
        </div>
      ) : null}

      {buyerJourneyPreview ? (
        <div className="rounded-md border border-border bg-background px-3 py-2 text-xs">
          <p className="font-medium">Buying Stage: {buyerJourneyPreview.buyingStageLabel}</p>
          <p className="mt-1">Conversation State: {buyerJourneyPreview.conversationStateLabel}</p>
          {buyerJourneyPreview.nextBestActions.length > 0 ? (
            <div className="mt-2">
              <p className="text-muted-foreground">Next Best Actions</p>
              <ul className="mt-1 list-none pl-0">
                {buyerJourneyPreview.nextBestActions.map((entry) => (
                  <li key={entry}>✓ {entry}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {buyerJourneyPreview.avoidActions.length > 0 ? (
            <div className="mt-2">
              <p className="text-muted-foreground">Avoid</p>
              <ul className="mt-1 list-none pl-0">
                {buyerJourneyPreview.avoidActions.map((entry) => (
                  <li key={entry}>⚠ {entry}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-2 text-muted-foreground">Confidence: {buyerJourneyPreview.confidence}%</p>
        </div>
      ) : null}

      {audit.warnings.length > 0 ? (
        <div className="space-y-2">
          {audit.warnings.map((warning) => (
            <div
              key={`${warning.code}-${warning.message}`}
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <div>
                <div className="font-medium capitalize">{warning.code.replace(/_/g, " ")}</div>
                <div>{warning.message}</div>
              </div>
              <GrowthBadge label={warning.severity} tone={warningTone(warning.severity)} />
            </div>
          ))}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Source signals</p>
        <div className="flex flex-wrap gap-1.5">
          {audit.sourceSignals.length === 0 ? (
            <span className="text-xs text-muted-foreground">No strong signals detected.</span>
          ) : (
            audit.sourceSignals.map((signal) => (
              <GrowthBadge key={signal} label={signal.replace(/_/g, " ")} tone="neutral" />
            ))
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected blocks</p>
        <ul className="space-y-2">
          {audit.selectedBlocks.map((block) => (
            <li key={`${block.key}-${block.blockId}`} className="rounded-md border border-border bg-background px-3 py-2 text-xs">
              <div className="font-medium capitalize">
                {block.key} · {block.label}
              </div>
              <div className="mt-1 text-muted-foreground">{block.text}</div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Context packet</p>
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Company</dt>
            <dd className="font-medium">{audit.contextPacket.companyName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Decision maker</dt>
            <dd className="font-medium">
              {audit.contextPacket.decisionMakerName ?? "—"}
              {audit.contextPacket.decisionMakerTitle ? ` · ${audit.contextPacket.decisionMakerTitle}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fit / engagement</dt>
            <dd className="font-medium">
              {audit.contextPacket.fitScore ?? "—"} / {audit.contextPacket.engagementScore ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Opportunity readiness</dt>
            <dd className="font-medium">{audit.contextPacket.opportunityReadinessTier ?? "—"}</dd>
          </div>
        </dl>
        {audit.contextPacket.websiteFindings.length > 0 ? (
          <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
            {audit.contextPacket.websiteFindings.slice(0, 4).map((finding) => (
              <li key={finding}>{finding}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Generated draft</p>
        {generatedSubject ? <p className="text-sm font-medium">Subject: {generatedSubject}</p> : null}
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs">{generatedContent}</pre>
        <p className="mt-1 text-xs text-muted-foreground">
          Variation key: {audit.variationKey} · Max words: {audit.maxWords}
        </p>
      </div>
    </div>
  )
}
