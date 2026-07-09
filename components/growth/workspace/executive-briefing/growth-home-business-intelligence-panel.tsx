"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthHomeConfidenceBadge } from "@/components/growth/workspace/executive-briefing/growth-home-confidence-badge"
import {
  GROWTH_BUSINESS_INTELLIGENCE_APPLY_TO_PROFILE_LABEL,
  GROWTH_BUSINESS_INTELLIGENCE_RECENTLY_RESEARCHED_LABEL,
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_PROMPT,
  type BusinessIntelligenceEvidenceSummary,
  type BusinessIntelligenceReviewDecisionSummary,
  type BusinessIntelligenceReviewDecisionType,
  type BusinessIntelligenceReviewFieldKey,
  type BusinessIntelligenceReviewProgress,
  type GrowthBusinessIntelligenceReportPayload,
} from "@/lib/growth/business-intelligence/business-intelligence-api-contract"
import type {
  BusinessIntelligenceAiRecommendation,
  BusinessIntelligenceGap,
  BusinessIntelligenceReportField,
} from "@/lib/growth/business-intelligence"
import { isUnknownField } from "@/lib/growth/business-intelligence"
import { GrowthHomeBusinessIntelligenceReviewField } from "@/components/growth/workspace/executive-briefing/growth-home-business-intelligence-review-field"
import { Button } from "@/components/ui/button"

function confidencePercent(value: number): number {
  return Math.round(value <= 1 ? value * 100 : value)
}

function formatFieldValue(value: string | string[] | null): React.ReactNode {
  if (value == null) return null
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return (
      <ul className="list-disc space-y-1 pl-5">
        {value.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }
  return <p>{value}</p>
}

function EvidenceList({
  evidenceIds,
  evidenceById,
}: {
  evidenceIds: string[]
  evidenceById: Record<string, BusinessIntelligenceEvidenceSummary>
}) {
  if (evidenceIds.length === 0) {
    return <p className="text-xs text-muted-foreground">No linked evidence items.</p>
  }

  return (
    <ul className="space-y-2">
      {evidenceIds.map((evidenceId) => {
        const evidence = evidenceById[evidenceId]
        if (!evidence) {
          return (
            <li key={evidenceId} className="rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
              Evidence {evidenceId} (details unavailable)
            </li>
          )
        }

        return (
          <li key={evidenceId} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{evidence.provider.replaceAll("_", " ")}</span>
              <GrowthHomeConfidenceBadge percent={confidencePercent(evidence.confidence)} />
              <GrowthBadge label={evidence.decision_tier.replaceAll("_", " ")} tone="neutral" />
              <GrowthBadge label={evidence.lifecycle_status.replaceAll("_", " ")} tone="neutral" />
            </div>
            {evidence.page_title ? <p className="mt-1 font-medium">{evidence.page_title}</p> : null}
            {evidence.source_url ? (
              <a
                href={evidence.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-primary underline-offset-2 hover:underline"
              >
                {evidence.source_url}
              </a>
            ) : null}
            {evidence.raw_excerpt ? (
              <p className="mt-1 text-muted-foreground line-clamp-3">{evidence.raw_excerpt}</p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function UnderstandingFieldBlock({
  title,
  field,
  evidenceById,
}: {
  title: string
  field: BusinessIntelligenceReportField
  evidenceById: Record<string, BusinessIntelligenceEvidenceSummary>
}) {
  const unknown = isUnknownField(field)

  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {unknown ? (
          <GrowthBadge label="Not yet known" tone="neutral" />
        ) : (
          <GrowthHomeConfidenceBadge percent={confidencePercent(field.confidence)} />
        )}
      </div>

      {unknown ? (
        <p className="mt-2 text-sm text-muted-foreground">{field.explanation}</p>
      ) : (
        <div className="mt-2 space-y-2 text-sm">{formatFieldValue(field.value)}</div>
      )}

      {!unknown && field.needs_review ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Needs human review</p>
      ) : null}

      <Accordion type="single" collapsible className="mt-3">
        <AccordionItem value="evidence" className="border-none">
          <AccordionTrigger className="py-1 text-xs font-medium hover:no-underline">
            View evidence ({field.supporting_evidence_ids.length})
          </AccordionTrigger>
          <AccordionContent>
            <EvidenceList evidenceIds={field.supporting_evidence_ids} evidenceById={evidenceById} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

function RecommendationCard({
  recommendation,
  evidenceById,
}: {
  recommendation: BusinessIntelligenceAiRecommendation
  evidenceById: Record<string, BusinessIntelligenceEvidenceSummary>
}) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold capitalize">{recommendation.category.replaceAll("_", " ")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <GrowthHomeConfidenceBadge percent={confidencePercent(recommendation.confidence)} />
          {recommendation.requires_human_review ? (
            <GrowthBadge label="Human review required" tone="attention" />
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-sm">{recommendation.recommendation}</p>
      <div className="mt-2 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Why I recommended this</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {recommendation.reasoning.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
      {(recommendation.supporting_evidence_ids.length > 0 || recommendation.related_gap_ids.length > 0) && (
        <Accordion type="single" collapsible className="mt-3">
          <AccordionItem value="evidence" className="border-none">
            <AccordionTrigger className="py-1 text-xs font-medium hover:no-underline">
              View supporting evidence
            </AccordionTrigger>
            <AccordionContent>
              <EvidenceList
                evidenceIds={recommendation.supporting_evidence_ids}
                evidenceById={evidenceById}
              />
              {recommendation.related_gap_ids.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Related gaps: {recommendation.related_gap_ids.join(", ")}
                </p>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  )
}

function GapCard({ gap }: { gap: BusinessIntelligenceGap }) {
  const tone = gap.severity === "high" ? "attention" : "neutral"

  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{gap.title}</p>
        <GrowthBadge label={gap.severity} tone={tone} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{gap.message}</p>
      {gap.requires_user_confirmation ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Operator confirmation needed</p>
      ) : null}
    </div>
  )
}

const REVIEW_FIELDS: Array<{
  fieldKey: BusinessIntelligenceReviewFieldKey
  title: string
  getField: (report: NonNullable<GrowthBusinessIntelligenceReportPayload["report"]>) => BusinessIntelligenceReportField
  requiresReview?: (report: NonNullable<GrowthBusinessIntelligenceReportPayload["report"]>) => boolean
}> = [
  {
    fieldKey: "company.company_description",
    title: "Company description",
    getField: (report) => report.sections.company.company_description,
    requiresReview: (report) =>
      report.sections.company.company_description.needs_review ||
      report.contradictions.some((item) => item.fact_key === "company.description"),
  },
  {
    fieldKey: "company.primary_offer",
    title: "Primary offer",
    getField: (report) => report.sections.company.primary_offer,
  },
  {
    fieldKey: "company.products",
    title: "Products",
    getField: (report) => report.sections.company.products,
  },
  {
    fieldKey: "company.services",
    title: "Services",
    getField: (report) => report.sections.company.services,
  },
  {
    fieldKey: "market.industries_served",
    title: "Industries served",
    getField: (report) => report.sections.market.industries_served,
  },
  {
    fieldKey: "market.geographic_markets",
    title: "Geographic markets",
    getField: (report) => report.sections.market.geographic_markets,
  },
  {
    fieldKey: "sales.likely_buyer_personas",
    title: "Buyer personas",
    getField: (report) => report.sections.sales_and_growth.likely_buyer_personas,
  },
  {
    fieldKey: "sales.likely_pain_points",
    title: "Pain points",
    getField: (report) => report.sections.sales_and_growth.likely_pain_points,
  },
  {
    fieldKey: "company.plans_pricing",
    title: "Pricing / plans",
    getField: (report) => report.sections.company.plans_pricing,
    requiresReview: (report) => isUnknownField(report.sections.company.plans_pricing),
  },
  {
    fieldKey: "company.differentiators",
    title: "Differentiators",
    getField: (report) => report.sections.company.differentiators,
  },
]

function ReviewProgressCard({ progress }: { progress: BusinessIntelligenceReviewProgress }) {
  return (
    <div className="rounded-lg border border-border/70 p-3" data-qa-section="bi-review-progress">
      <p className="text-sm font-semibold">Review progress</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Fields reviewed</p>
          <p className="text-sm font-semibold tabular-nums">
            {progress.reviewed_count} of {progress.total_review_fields}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Unresolved contradictions</p>
          <p className="text-sm font-semibold tabular-nums">{progress.unresolved_contradictions}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Missing confirmations</p>
          <p className="text-sm font-semibold tabular-nums">{progress.missing_required_confirmations}</p>
        </div>
      </div>
    </div>
  )
}

export function GrowthHomeBusinessIntelligencePanel({
  payload,
  recentlyResearched = false,
  showReviewPrompt = false,
  reviewBusyFieldKey = null,
  applyBusy = false,
  applyMessage = null,
  onReviewDecision,
  onApplyToProfile,
}: {
  payload: GrowthBusinessIntelligenceReportPayload
  recentlyResearched?: boolean
  showReviewPrompt?: boolean
  reviewBusyFieldKey?: string | null
  applyBusy?: boolean
  applyMessage?: string | null
  onReviewDecision?: (input: {
    fieldKey: BusinessIntelligenceReviewFieldKey
    decision: BusinessIntelligenceReviewDecisionType
    approvedValue?: string | string[] | null
  }) => Promise<void>
  onApplyToProfile?: () => Promise<void>
}) {
  const report = payload.report
  if (!report) return null

  const summary = payload.confidence_summary ?? report.confidence_summary
  const recommendations = payload.ai_recommendations ?? report.ai_recommendations ?? []
  const reviewDecisions = payload.review_decisions ?? {}
  const reviewProgress = payload.review_progress

  return (
    <div className="space-y-4" data-qa-panel="business-intelligence">
      {showReviewPrompt ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          {GROWTH_BUSINESS_INTELLIGENCE_REVIEW_PROMPT}
        </div>
      ) : null}

      <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Review my findings before they affect your approved Business Profile or downstream systems.
      </div>

      {payload.generated_at ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Report generated {new Date(payload.generated_at).toLocaleString()}
            {payload.status ? ` · ${payload.status}` : ""}
          </p>
          {recentlyResearched ? <GrowthBadge label={GROWTH_BUSINESS_INTELLIGENCE_RECENTLY_RESEARCHED_LABEL} tone="healthy" /> : null}
        </div>
      ) : recentlyResearched ? (
        <GrowthBadge label={GROWTH_BUSINESS_INTELLIGENCE_RECENTLY_RESEARCHED_LABEL} tone="healthy" />
      ) : null}

      <div className="rounded-lg border border-border/70 p-3">
        <p className="text-sm font-semibold">Confidence summary</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Overall confidence</p>
            <GrowthHomeConfidenceBadge percent={confidencePercent(summary.overall_confidence)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Evidence strength</p>
            <GrowthHomeConfidenceBadge percent={confidencePercent(summary.evidence_strength)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Freshness strength</p>
            <GrowthHomeConfidenceBadge percent={confidencePercent(summary.freshness_strength)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unknown fields</p>
            <p className="text-sm font-semibold tabular-nums">{summary.unknown_count}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Needs review</p>
            <p className="text-sm font-semibold tabular-nums">{summary.needs_review_count}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contradictions</p>
            <p className="text-sm font-semibold tabular-nums">{summary.contradiction_count}</p>
          </div>
        </div>
      </div>

      {reviewProgress ? <ReviewProgressCard progress={reviewProgress} /> : null}

      <div className="space-y-3">
        <p className="text-sm font-semibold">Review my understanding</p>
        {REVIEW_FIELDS.map((item) => (
          <GrowthHomeBusinessIntelligenceReviewField
            key={item.fieldKey}
            fieldKey={item.fieldKey}
            title={item.title}
            field={item.getField(report)}
            evidenceById={payload.evidence_by_id}
            decision={reviewDecisions[item.fieldKey] as BusinessIntelligenceReviewDecisionSummary | undefined}
            requiresReview={item.requiresReview?.(report) ?? false}
            busy={reviewBusyFieldKey === item.fieldKey}
            onDecision={onReviewDecision ?? (async () => undefined)}
          />
        ))}
      </div>

      {onApplyToProfile ? (
        <div className="rounded-lg border border-border/70 p-3 space-y-2">
          <Button
            type="button"
            size="sm"
            disabled={!reviewProgress?.can_apply_to_profile || applyBusy}
            onClick={() => void onApplyToProfile()}
            data-qa-action="apply-to-business-profile"
          >
            {GROWTH_BUSINESS_INTELLIGENCE_APPLY_TO_PROFILE_LABEL}
          </Button>
          {!reviewProgress?.can_apply_to_profile ? (
            <p className="text-xs text-muted-foreground">
              Complete required reviews and resolve contradictions before updating Business Profile.
            </p>
          ) : null}
          {applyMessage ? <p className="text-xs text-muted-foreground">{applyMessage}</p> : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-sm font-semibold">Additional proof &amp; trust</p>
        <UnderstandingFieldBlock
          title="Testimonials"
          field={report.sections.proof_and_trust.testimonials}
          evidenceById={payload.evidence_by_id}
        />
        <UnderstandingFieldBlock
          title="Case studies"
          field={report.sections.proof_and_trust.case_studies}
          evidenceById={payload.evidence_by_id}
        />
        <UnderstandingFieldBlock
          title="Certifications"
          field={report.sections.proof_and_trust.certifications}
          evidenceById={payload.evidence_by_id}
        />
      </div>

      {payload.contradictions.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Evidence conflicts</p>
          {payload.contradictions.map((contradiction) => (
            <div key={contradiction.fact_key} className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="text-sm font-semibold">{contradiction.fact_key.replaceAll(".", " · ")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Conflicting values: {contradiction.conflicting_values.join(" · ")}
              </p>
              <Accordion type="single" collapsible className="mt-2">
                <AccordionItem value="evidence" className="border-none">
                  <AccordionTrigger className="py-1 text-xs font-medium hover:no-underline">
                    View conflicting evidence
                  </AccordionTrigger>
                  <AccordionContent>
                    <EvidenceList evidenceIds={contradiction.evidence_ids} evidenceById={payload.evidence_by_id} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ))}
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Recommendations</p>
          {recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.recommendation_id}
              recommendation={recommendation}
              evidenceById={payload.evidence_by_id}
            />
          ))}
        </div>
      ) : null}

      {payload.gaps.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Gaps &amp; questions for you</p>
          {payload.gaps.map((gap) => (
            <GapCard key={gap.gap_id} gap={gap} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
