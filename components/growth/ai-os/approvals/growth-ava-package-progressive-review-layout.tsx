"use client"

import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { GrowthAvaMemoryReviewSection } from "@/components/growth/ai-os/approvals/growth-ava-memory-review-section"
import { GrowthBadge, GrowthCollapsibleEngineCard } from "@/components/growth/growth-ui-utils"
import type { Approvals2AOperatorReviewPacket } from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import {
  GROWTH_OPERATOR_PACKAGE_PROGRESSIVE_REVIEW_2A_QA_MARKER,
  type OperatorPackageChannelReadinessRow,
  type OperatorPackageDecisionSummary,
} from "@/lib/growth/workspace/ux-2a/review/growth-operator-package-progressive-review-2a"
import {
  GROWTH_OPERATOR_PACKAGE_RECOMMENDATION_2D_QA_MARKER,
  type OperatorPackageRecommendation,
} from "@/lib/growth/workspace/ux-2d/review/growth-operator-package-recommendation-2d"
import {
  GROWTH_EXECUTIVE_APPROVAL_PACKAGE_1D_QA_MARKER,
  projectExecutiveApprovalPackage1D,
} from "@/lib/growth/workspace/ux-1d/review/growth-executive-approval-package-1d"
import { GROWTH_EXECUTIVE_SHOW_AVA_WORK_LABEL, formatExecutiveConfidenceLabel } from "@/lib/growth/aios/operator-experience/growth-executive-experience-1d"

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function BulletList({ lines }: { lines: string[] }) {
  if (!lines.length) return <p className="text-sm text-muted-foreground">Not prepared</p>
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

function EditableBlock({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  rows?: number
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="min-h-[88px] resize-y text-sm"
        aria-label={label}
      />
    </div>
  )
}

function SummaryBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-lg border border-border/60 bg-background/80 p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  )
}

function qualityBadgeTone(state: OperatorPackageRecommendation["qualityState"]): "healthy" | "attention" | "neutral" {
  if (state === "ready") return "healthy"
  if (state === "needs_attention") return "attention"
  return "neutral"
}

function qualityBadgeLabel(state: OperatorPackageRecommendation["qualityState"]): string {
  if (state === "ready") return "Ready for your decision"
  if (state === "needs_attention") return "Review assumptions"
  return "Limited evidence"
}

function EvidenceGroup({
  label,
  lines,
}: {
  label: string
  lines: string[]
}) {
  if (!lines.length) return null
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <BulletList lines={lines} />
    </div>
  )
}

function channelBadgeTone(row: OperatorPackageChannelReadinessRow): "healthy" | "attention" | "neutral" | "blocked" {
  if (row.content === "prepared" && row.contact !== "contact_missing") return "healthy"
  if (row.content === "prepared" && row.contact === "contact_missing") return "attention"
  if (row.content === "missing" || row.contact === "contact_missing") return "attention"
  if (row.content === "unsupported") return "blocked"
  return "neutral"
}

function DraftEditorBlock({
  draft,
  draftEdits,
  onDraftChange,
}: {
  draft: Approvals2AOperatorReviewPacket["drafts"][number]
  draftEdits: Record<string, string>
  onDraftChange: (channel: string, next: string) => void
}) {
  if (!draft.prepared) {
    return <p className="text-sm text-muted-foreground">Not prepared</p>
  }

  return (
    <div className="rounded-md border bg-background/80 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{draft.label}</span>
        {draft.versionStatus === "approved" ? (
          <Badge variant="default">Approved</Badge>
        ) : draft.versionStatus === "edited" ? (
          <Badge variant="secondary">Edited</Badge>
        ) : (
          <Badge variant="outline">Generated</Badge>
        )}
      </div>
      <div className="mt-2">
        <EditableBlock
          label={`${draft.label} (editable)`}
          value={draftEdits[draft.channel] ?? draft.preview ?? ""}
          onChange={(next) => onDraftChange(draft.channel, next)}
          rows={draft.channel === "sms" || draft.channel === "linkedin" ? 3 : 6}
        />
        {draft.constitutionWarnings?.length ? (
          <div className="mt-2 rounded-md border border-amber-300/70 bg-amber-50/50 p-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
            <p className="font-medium">Review notes</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {draft.constitutionWarnings.slice(0, 4).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}

type Props = {
  view: Approvals2AOperatorReviewPacket
  summary: OperatorPackageDecisionSummary
  recommendation: OperatorPackageRecommendation
  teammateName: string
  packageId: string
  leadId: string
  draftEdits: Record<string, string>
  onDraftChange: (channel: string, next: string) => void
  strategyEdit: string
  onStrategyEdit: (next: string) => void
  busy: boolean
  onSaveDrafts: () => void
  onMemoryUpdated: (rows: Approvals2AOperatorReviewPacket["memoryReview"]) => void
}

export function GrowthAvaPackageProgressiveReviewLayout({
  view,
  summary,
  recommendation,
  teammateName,
  packageId,
  leadId,
  draftEdits,
  onDraftChange,
  strategyEdit,
  onStrategyEdit,
  busy,
  onSaveDrafts,
  onMemoryUpdated,
}: Props) {
  const executivePackage = projectExecutiveApprovalPackage1D({
    packet: view,
    summary,
    recommendation,
  })

  const visibleChannelRows = summary.channelReadiness.filter((row) => {
    if (row.content === "prepared") return true
    if (row.content === "missing" && row.contact === "contact_missing") {
      return row.channel === "call" || row.channel === "voicemail" || row.channel === "sms"
    }
    return false
  })

  return (
    <div
      className="mt-5 space-y-4"
      data-qa-marker={GROWTH_OPERATOR_PACKAGE_PROGRESSIVE_REVIEW_2A_QA_MARKER}
      data-qa-marker-recommendation-2d={GROWTH_OPERATOR_PACKAGE_RECOMMENDATION_2D_QA_MARKER}
      data-qa-marker-executive-1d={GROWTH_EXECUTIVE_APPROVAL_PACKAGE_1D_QA_MARKER}
      data-qa-section="package-review-level-1"
    >
      <SummaryBlock title="Executive recommendation">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <GrowthBadge
              label={executivePackage.qualityLabel}
              tone={qualityBadgeTone(recommendation.qualityState)}
            />
            <span className="text-xs text-muted-foreground">{executivePackage.confidenceLabel}</span>
          </div>

          {executivePackage.weakEvidenceIntro ? (
            <div className="rounded-md border border-amber-200/70 bg-amber-50/40 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
              {executivePackage.weakEvidenceIntro}
            </div>
          ) : null}

          <div>
            <p className="text-lg font-semibold text-foreground">{executivePackage.company.name}</p>
            {executivePackage.company.context ? (
              <p className="mt-1 text-sm text-muted-foreground">{executivePackage.company.context}</p>
            ) : null}
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {executivePackage.executiveRecommendation}
            </p>
          </div>

          {executivePackage.company.icpFitSummary.length ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Why this company fits your ICP
              </p>
              <BulletList lines={executivePackage.company.icpFitSummary} />
            </div>
          ) : null}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Decision maker
            </p>
            <p className="mt-1 text-sm text-foreground">
              {executivePackage.decisionMaker.name
                ? `${executivePackage.decisionMaker.name}${executivePackage.decisionMaker.title ? ` · ${executivePackage.decisionMaker.title}` : ""}`
                : "No verified contact on file yet."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{executivePackage.decisionMaker.contactSummary}</p>
            {recommendation.recommendedBuyer.weakContact ? (
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                Contact confidence is limited — verify the buyer before approving outreach.
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Recommended outreach strategy
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {executivePackage.outreachStrategyDetail.angle}
            </p>
            <p className="mt-1 text-sm text-foreground">
              {executivePackage.outreachStrategyDetail.angleRationale}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Recommended action
            </p>
            <p className="mt-1 text-sm text-foreground">{executivePackage.recommendedAction}</p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Prepared outreach messages
            </p>
            {executivePackage.preparedMessages.length ? (
              <div className="flex flex-wrap gap-2">
                {executivePackage.preparedMessages.map((message) => (
                  <GrowthBadge key={message.channel} label={message.label} tone="healthy" />
                ))}
              </div>
            ) : (
              <GrowthBadge label="No drafts prepared" tone="attention" />
            )}
          </div>

          {summary.primaryEmailDraft ? (
            <div className="space-y-2">
              <DraftEditorBlock
                draft={summary.primaryEmailDraft}
                draftEdits={draftEdits}
                onDraftChange={onDraftChange}
              />
            </div>
          ) : null}

          {summary.secondaryPreparedDrafts.length ? (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Other prepared messages
              </p>
              <div className="space-y-2">
                {summary.secondaryPreparedDrafts.map((draft) => (
                  <GrowthCollapsibleEngineCard
                    key={draft.channel}
                    title={draft.label}
                    defaultOpen={false}
                    compact
                    persistKey={`ava-outreach-draft-${packageId}-${draft.channel}`}
                    headerAside={<GrowthBadge label="Prepared" tone="healthy" />}
                  >
                    <DraftEditorBlock
                      draft={draft}
                      draftEdits={draftEdits}
                      onDraftChange={onDraftChange}
                    />
                  </GrowthCollapsibleEngineCard>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy || !leadId} onClick={onSaveDrafts}>
              {busy ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
              Save draft edits
            </Button>
            <span className="text-xs text-muted-foreground">
              Save edits before you approve — I will use the saved version when sending is enabled.
            </span>
          </div>
        </div>
      </SummaryBlock>

      <GrowthCollapsibleEngineCard
        title={GROWTH_EXECUTIVE_SHOW_AVA_WORK_LABEL}
        defaultOpen={false}
        compact
        persistKey={`ava-outreach-executive-work-${packageId}`}
      >
        <div className="space-y-4" data-qa-section="package-review-show-ava-work">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Why now
            </p>
            <p className="mt-1 text-sm text-foreground">{recommendation.whyNow}</p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              First-conversation strategy
            </p>
            <div className="mt-1 space-y-1 text-sm text-foreground">
              <p>
                <span className="font-medium">Opening premise:</span>{" "}
                {executivePackage.outreachStrategyDetail.openingPremise}
              </p>
              <p>
                <span className="font-medium">Discovery question:</span>{" "}
                {executivePackage.outreachStrategyDetail.discoveryQuestion}
              </p>
              <p>
                <span className="font-medium">Desired next step:</span>{" "}
                {executivePackage.outreachStrategyDetail.desiredNextStep}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Evidence and uncertainty
            </p>
            <EvidenceGroup label="Verified" lines={recommendation.evidenceAndUncertainty.verified} />
            <EvidenceGroup label="Inferred" lines={recommendation.evidenceAndUncertainty.inferred} />
            <EvidenceGroup label="Unknown" lines={recommendation.evidenceAndUncertainty.unknown} />
          </div>

          {!recommendation.draftAlignment.aligned ? (
            <div className="rounded-md border border-amber-200/70 bg-amber-50/40 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
              <p className="font-medium">Draft alignment</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {recommendation.draftAlignment.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {summary.riskStatement ? (
            <div className="rounded-md border border-amber-200/70 bg-amber-50/40 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
              {summary.riskStatement}
            </div>
          ) : null}

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Contact strategy
            </p>
            {summary.contactWarning ? (
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">{summary.contactWarning}</p>
            ) : (
              <p className="mt-1 text-sm text-foreground">{summary.contactReadySummary}</p>
            )}
          </div>

          <div className="grid gap-2 rounded-md border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <p className="font-medium text-foreground">Content readiness</p>
              <p className="mt-1">{summary.contentReadySummary}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Contact readiness</p>
              <p className="mt-1">{summary.contactReadySummary}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Sending readiness</p>
              <p className="mt-1">{summary.transportSummary}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Prepared channels</p>
              <p className="mt-1">
                {visibleChannelRows.length
                  ? visibleChannelRows.map((row) => row.operatorLabel).join(" · ")
                  : "None prepared"}
              </p>
            </div>
          </div>

          <GrowthCollapsibleEngineCard
            title="Supporting research"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-l2-research-${packageId}`}
          >
        <div className="space-y-4" data-qa-section="package-review-level-2-research">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Company" value={view.company.name} />
            <Field label="Website" value={view.company.website ?? "Not on record"} />
            <Field label="Industry" value={view.company.industry ?? "Not prepared"} />
            <Field label="Location" value={view.company.location ?? "Not on record"} />
            <Field
              label="Equipment serviced"
              value={
                view.company.equipmentServiced.length
                  ? view.company.equipmentServiced.join(" · ")
                  : "Not prepared"
              }
            />
          </div>
          <BulletList lines={view.operatorReviewLayout.researchSummary} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {view.evidenceCards.map((evidence) => (
              <div key={evidence.id} className="rounded-md border bg-background/80 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span aria-hidden>{evidence.present ? "✓" : "○"}</span>
                  <span className="font-medium">{evidence.label}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {evidence.present ? evidence.detail ?? "Evidence present" : "Not prepared"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </GrowthCollapsibleEngineCard>

      <GrowthCollapsibleEngineCard
        title="Why Ava recommends this"
        defaultOpen={false}
        compact
        persistKey={`ava-outreach-l2-recommendation-${packageId}`}
      >
        <div className="space-y-4" data-qa-section="package-review-level-2-recommendation">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {`Why ${teammateName} chose this account`}
            </p>
            <BulletList lines={view.whySelected} />
          </div>
          {view.operatorReviewLayout.revenueStrategyEssentials.length ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sales recommendation</p>
              <BulletList lines={view.operatorReviewLayout.revenueStrategyEssentials} />
            </div>
          ) : null}
          {view.operatorReviewLayout.relationshipStrategyEssentials.length ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Relationship strategy</p>
              <BulletList lines={view.operatorReviewLayout.relationshipStrategyEssentials} />
            </div>
          ) : null}
        </div>
      </GrowthCollapsibleEngineCard>

      <GrowthCollapsibleEngineCard
        title="Review qualification evidence"
        defaultOpen={false}
        compact
        persistKey={`ava-outreach-l2-qualification-${packageId}`}
      >
        <div className="space-y-4" data-qa-section="package-review-level-2-qualification">
          <BulletList lines={view.knowledgeLayers.prospectTruth.slice(0, 6)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Research completeness" value={view.risk.researchCompleteness} />
            <Field label="Contact verification" value={view.risk.contactVerification} />
            <Field label="Spam risk" value={view.risk.spamRisk} />
            <Field label="Bounce risk" value={view.risk.bounceRisk} />
          </div>
        </div>
      </GrowthCollapsibleEngineCard>

      <GrowthCollapsibleEngineCard
        title="View contact and conversation strategy"
        defaultOpen={false}
        compact
        persistKey={`ava-outreach-l2-contact-${packageId}`}
      >
        <div className="space-y-4" data-qa-section="package-review-level-2-contact">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Name" value={view.decisionMaker.name ?? "Not prepared"} />
            <Field label="Title" value={view.decisionMaker.title ?? "Not prepared"} />
            <Field label="Email" value={view.decisionMaker.email ?? "Not prepared"} />
            <Field label="Phone" value={view.decisionMaker.phone ?? "Not prepared"} />
            <Field label="LinkedIn" value={view.decisionMaker.linkedIn ?? "Not prepared"} />
            <Field
              label="Verification status"
              value={view.decisionMaker.verificationStatus ?? "Not prepared"}
            />
          </div>
          <BulletList lines={view.operatorReviewLayout.conversationStrategyEssentials} />
          {view.operatorReviewLayout.sellerTruthEssentials.length ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Seller guidance</p>
              <BulletList lines={view.operatorReviewLayout.sellerTruthEssentials.slice(0, 5)} />
            </div>
          ) : null}
        </div>
      </GrowthCollapsibleEngineCard>

      <GrowthCollapsibleEngineCard
        title="Advanced details"
        defaultOpen={false}
        compact
        persistKey={`ava-outreach-l3-advanced-${packageId}`}
      >
        <div className="space-y-3" data-qa-section="package-review-level-3">
          {view.memoryReview.length ? (
            <GrowthAvaMemoryReviewSection
              leadId={leadId}
              packageId={packageId}
              rows={view.memoryReview}
              onUpdated={onMemoryUpdated}
            />
          ) : null}

          {view.operatorReviewLayout.canonicalDecisionEssentials.length ? (
            <SummaryBlock title="Why I prepared this package">
              <BulletList lines={view.operatorReviewLayout.canonicalDecisionEssentials} />
            </SummaryBlock>
          ) : null}

          {view.operatorReviewLayout.canonicalDecisionEnforcementEssentials.length ? (
            <SummaryBlock title="Execution status">
              <BulletList lines={view.operatorReviewLayout.canonicalDecisionEnforcementEssentials} />
            </SummaryBlock>
          ) : null}

          <GrowthCollapsibleEngineCard
            title="Risk panel"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-risk-${packageId}`}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Spam risk" value={view.risk.spamRisk} />
              <Field label="Bounce risk" value={view.risk.bounceRisk} />
              <Field
                label="Relationship strength"
                value={view.risk.relationshipStrength ?? "Not prepared"}
              />
              <Field
                label="Unknown fields"
                value={
                  view.risk.unknownFields.length ? view.risk.unknownFields.join(", ") : "None listed"
                }
              />
              <Field
                label="Blocking autonomous send"
                value={view.risk.autonomousSendBlockedReasons.join(" · ")}
              />
            </div>
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Seller truth detail"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-seller-${packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.expandable.sellerTruthDetail} />
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Prospect truth detail"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-prospect-${packageId}`}
          >
            <BulletList lines={view.knowledgeLayers.prospectTruth} />
            {view.operatorReviewLayout.expandable.prospectTruthDetail.length ? (
              <div className="mt-3">
                <BulletList lines={view.operatorReviewLayout.expandable.prospectTruthDetail} />
              </div>
            ) : null}
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Relationship strategy detail"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-relationship-strategy-${packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.expandable.relationshipStrategyDetail} />
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Sales strategy detail"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-revenue-strategy-${packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.expandable.revenueStrategyDetail} />
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Observation intelligence"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-observations-${packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.expandable.observationIntelligence} />
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Consultant reasoning detail"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-consultant-${packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.expandable.consultantDiscoveryDetail} />
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Explainability"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-explain-${packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.expandable.explainabilityDetail} />
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Strategy detail"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-strategy-${packageId}`}
          >
            {view.salesStrategy ? (
              <div className="space-y-3">
                <BulletList lines={view.operatorReviewLayout.expandable.strategyDetail} />
                <EditableBlock
                  label="Strategy (editable)"
                  value={strategyEdit}
                  onChange={onStrategyEdit}
                  rows={8}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Strategy brief was not attached to this package.</p>
            )}
          </GrowthCollapsibleEngineCard>

          <GrowthCollapsibleEngineCard
            title="Transparency and metadata"
            defaultOpen={false}
            compact
            persistKey={`ava-outreach-transparency-${packageId}`}
          >
            <BulletList lines={view.operatorReviewLayout.expandable.transparencyDetail} />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Employees" value={view.company.employees ?? "Not on record"} />
              <Field label="Revenue estimate" value={view.company.revenueEstimate ?? "Not on record"} />
              <Field
                label="Research confidence"
                value={
                  view.company.researchConfidence != null
                    ? formatExecutiveConfidenceLabel(view.company.researchConfidence)
                    : "Not prepared"
                }
              />
              <Field label="Package version" value={view.transparency.packageVersion} />
            </div>
          </GrowthCollapsibleEngineCard>
        </div>
      </GrowthCollapsibleEngineCard>
        </div>
      </GrowthCollapsibleEngineCard>
    </div>
  )
}
