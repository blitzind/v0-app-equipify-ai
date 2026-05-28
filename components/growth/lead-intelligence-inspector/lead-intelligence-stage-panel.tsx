"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LeadIntelligenceEvidencePanel } from "@/components/growth/lead-intelligence-inspector/lead-intelligence-evidence-panel"
import { LeadIntelligenceStageEmptyState } from "@/components/growth/lead-intelligence-inspector/lead-intelligence-stage-empty-state"
import {
  LeadIntelligenceConfidenceBadge,
  LeadIntelligenceStageStateBadge,
} from "@/components/growth/lead-intelligence-inspector/lead-intelligence-stage-state-badge"
import {
  LEAD_HUMAN_APPROVAL_QA_MARKER,
  LEAD_STAGE_SUMMARY_QA_MARKER,
} from "@/lib/growth/lead-engine/lead-intelligence-inspector-qa"
import { LEAD_INTELLIGENCE_STAGE_EMPTY_PREVIEWS } from "@/lib/growth/lead-engine/lead-intelligence-stage-empty-previews"
import type { LeadEngineStageUiDefinition } from "@/lib/growth/lead-engine/lead-engine-stage-ui"
import {
  buildLeadIntelligenceStageOperatorSummary,
  collectLeadIntelligenceEvidenceItems,
  resolveLeadIntelligenceStageUxState,
  type LeadIntelligenceStageDisplayContext,
} from "@/lib/growth/lead-engine/lead-intelligence-stage-display"
import type { GrowthLeadEngineOrchestratorStageResult } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import { cn } from "@/lib/utils"

function CollapsibleBlock({
  title,
  defaultOpen = false,
  children,
  qaMarker,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
  qaMarker?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-border" data-qa-marker={qaMarker}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium hover:bg-muted/40"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        {title}
      </button>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  )
}

function OperatorSummarySection({
  summary,
  uxState,
  durationMs,
  isSampleMode,
}: {
  summary: ReturnType<typeof buildLeadIntelligenceStageOperatorSummary>
  uxState: ReturnType<typeof resolveLeadIntelligenceStageUxState>
  durationMs: number
  isSampleMode: boolean
}) {
  return (
    <div className="space-y-4 px-4 py-4" data-qa-marker={LEAD_STAGE_SUMMARY_QA_MARKER}>
      {isSampleMode ? (
        <p className="rounded-md border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-xs text-amber-950">
          Sample pipeline — intelligence is deterministic fixture data, clearly labeled for operator training.
        </p>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
        <p className="mt-1.5 text-sm leading-relaxed">{summary.executiveSummary}</p>
      </div>

      {summary.signalChips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {summary.signalChips.map((chip) => (
            <Badge key={chip} variant="secondary" className="text-[11px] font-normal">
              {chip}
            </Badge>
          ))}
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key findings</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
          {summary.keyFindings.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold text-muted-foreground">Confidence</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <LeadIntelligenceConfidenceBadge
              percent={summary.confidencePercent}
              band={summary.confidenceBand}
            />
            {uxState === "confidence_low" ? (
              <Badge variant="outline" className="border-amber-300 text-amber-900">
                thin evidence
              </Badge>
            ) : null}
          </div>
          {summary.confidenceReasoning.length > 0 ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {summary.confidenceReasoning.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-semibold text-muted-foreground">Evidence</p>
          <p className="mt-2 text-lg font-semibold">{summary.evidenceCount}</p>
          <p className="text-xs text-muted-foreground">linked items</p>
          {durationMs > 0 ? (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              {durationMs}ms execution
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-semibold text-muted-foreground">Recommended action</p>
          <p className="mt-2 text-sm font-medium leading-snug">{summary.recommendedAction}</p>
        </div>
      </div>

      {summary.risksAndMissingData.length > 0 ? (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
            <AlertTriangle className="size-3.5" />
            Risks / missing data
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
            {summary.risksAndMissingData.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.operatorGuidance ? (
        <p className="rounded-md border border-sky-200/80 bg-sky-50/60 px-3 py-2 text-sm text-sky-950">
          {summary.operatorGuidance}
        </p>
      ) : null}
    </div>
  )
}

function HumanApprovalActions() {
  return (
    <div
      className="border-t border-border px-4 py-3"
      data-qa-marker={LEAD_HUMAN_APPROVAL_QA_MARKER}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Operator review checkpoint
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Decisions are recorded in Lead Inbox — no autonomous approval or outreach.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="default">
          <Link href="/admin/growth/leads">Approve in Lead Inbox</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/growth/leads">Hold / request research</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/growth/leads">Reject</Link>
        </Button>
      </div>
    </div>
  )
}

function ContactResearchActions() {
  return (
    <div className="border-t border-border px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Operator actions
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/growth/leads">
            Review contacts
            <ExternalLink className="ml-1.5 size-3" />
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/growth/search">Request enrichment</Link>
        </Button>
      </div>
    </div>
  )
}

export function LeadIntelligenceStagePanel({
  stage,
  stageDef,
  displayContext,
}: {
  stage: GrowthLeadEngineOrchestratorStageResult
  stageDef: LeadEngineStageUiDefinition
  displayContext: LeadIntelligenceStageDisplayContext
}) {
  const uxState = resolveLeadIntelligenceStageUxState(stage, displayContext)
  const summary = buildLeadIntelligenceStageOperatorSummary(stage)
  const evidenceItems = collectLeadIntelligenceEvidenceItems(stage)
  const emptyPreview = LEAD_INTELLIGENCE_STAGE_EMPTY_PREVIEWS[stageDef.stageKey]
  const showEmpty = uxState === "awaiting_input" || uxState === "queued"
  const showSummary = !showEmpty && stage.status !== "pending"

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow",
        uxState === "evidence_ready" && "border-emerald-200/80",
        uxState === "needs_review" && "border-amber-300/80",
        uxState === "blocked" && "border-destructive/30",
      )}
      data-qa-marker={stageDef.qaMarker}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{stage.label}</p>
            <LeadIntelligenceStageStateBadge state={uxState} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{stageDef.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {summary.confidencePercent != null && showSummary ? (
            <LeadIntelligenceConfidenceBadge
              percent={summary.confidencePercent}
              band={summary.confidenceBand}
            />
          ) : null}
          {stage.duration_ms > 0 ? (
            <Badge variant="outline" className="font-normal">
              <Clock className="mr-1 size-3" />
              {stage.duration_ms}ms
            </Badge>
          ) : null}
          {summary.evidenceCount > 0 ? (
            <Badge variant="secondary" className="font-normal">
              {summary.evidenceCount} evidence
            </Badge>
          ) : null}
          {stage.human_review_required ? (
            <Badge variant="outline" className="border-amber-300 text-amber-900">
              review
            </Badge>
          ) : null}
          {stage.fatal ? <Badge variant="destructive">fatal</Badge> : null}
        </div>
      </div>

      {stage.parse_message ? (
        <div className="border-b border-border bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {stage.parse_message}
        </div>
      ) : null}

      {stage.warnings.length > 0 ? (
        <div className="border-b border-border bg-amber-50 px-4 py-2 text-sm text-amber-950">
          {stage.warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="p-4">
          <LeadIntelligenceStageEmptyState
            preview={emptyPreview}
            stageLabel={stage.label}
            isSamplePreview={displayContext.isSampleMode && !displayContext.hasRun}
          />
        </div>
      ) : null}

      {showSummary ? (
        <OperatorSummarySection
          summary={summary}
          uxState={uxState}
          durationMs={stage.duration_ms}
          isSampleMode={displayContext.isSampleMode}
        />
      ) : null}

      {showSummary && evidenceItems.length > 0 ? (
        <div className="border-t border-border px-4 py-4">
          <LeadIntelligenceEvidencePanel
            items={evidenceItems}
            summary={stage.evidence?.summary}
          />
        </div>
      ) : null}

      {showSummary && stage.stage_id === "contact_research" ? <ContactResearchActions /> : null}
      {showSummary && stage.stage_id === "human_approval" ? <HumanApprovalActions /> : null}

      <CollapsibleBlock title="Structured output & diagnostics">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Structured output</p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-xs">
              {stage.parsed ? JSON.stringify(stage.parsed, null, 2) : "(no parsed output)"}
            </pre>
          </div>

          {stage.diagnostics.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Validation metadata</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {stage.diagnostics.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </CollapsibleBlock>
    </div>
  )
}

export function LeadIntelligenceTechnicalDetails({
  title = "Technical Details",
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      <CollapsibleBlock title={title}>{children}</CollapsibleBlock>
    </div>
  )
}
