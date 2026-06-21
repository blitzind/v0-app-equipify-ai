"use client"

import { Loader2, Sparkles } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { formatPersonalizationDraftTimestamp } from "@/lib/growth/personalization/growth-personalization-draft-formatting"
import type { GrowthPersonalizationLeadSummary } from "@/lib/growth/personalization/embedded/growth-personalization-embedded-types"
import { GROWTH_PERSONALIZATION_EMBEDDED_QA_MARKER } from "@/lib/growth/personalization/embedded/growth-personalization-embedded-types"
import { GrowthPersonalizationActions } from "@/components/growth/personalization/embedded/growth-personalization-actions"
import { GrowthPersonalizationPreviewCard } from "@/components/growth/personalization/embedded/growth-personalization-preview-card"
import { GrowthPersonalizationStageCard } from "@/components/growth/personalization/embedded/growth-personalization-stage-card"
import { personalizationStatusLabel } from "@/lib/growth/personalization/personalization-types"

function SummarySkeleton() {
  return (
    <div className="animate-pulse space-y-2 rounded-lg border border-border/60 p-3">
      <div className="h-3 w-1/3 rounded bg-muted" />
      <div className="h-8 rounded bg-muted" />
      <div className="h-16 rounded bg-muted" />
    </div>
  )
}

type Props = {
  leadId: string
  summary: GrowthPersonalizationLeadSummary | null
  loading?: boolean
  generating?: boolean
  error?: string | null
  onGenerate?: () => void
  onRegenerate?: () => void
  onApprove?: () => void
  onEdit?: () => void
  showStage?: boolean
  showPreview?: boolean
  showApprove?: boolean
  showEdit?: boolean
  compact?: boolean
  title?: string
}

export function GrowthPersonalizationSummaryCard({
  leadId,
  summary,
  loading = false,
  generating = false,
  error = null,
  onGenerate,
  onRegenerate,
  onApprove,
  onEdit,
  showStage = true,
  showPreview = true,
  showApprove = false,
  showEdit = false,
  compact = false,
  title = "AI Personalization",
}: Props) {
  if (loading && !summary) {
    return <SummarySkeleton />
  }

  return (
    <section
      className={`rounded-xl border border-border/60 bg-card ${compact ? "p-2.5" : "p-3"}`}
      data-qa={GROWTH_PERSONALIZATION_EMBEDDED_QA_MARKER}
      data-qa-component="growth-personalization-summary-card"
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-600" />
          <h3 className={`font-semibold ${compact ? "text-xs" : "text-sm"}`}>{title}</h3>
        </div>
        {summary?.status ? (
          <GrowthBadge label={personalizationStatusLabel(summary.status)} tone="attention" />
        ) : null}
      </div>

      {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}

      {summary ? (
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {summary.industryLabel ? <span>Industry: {summary.industryLabel}</span> : null}
          {summary.buyingStageLabel ? <span>Stage: {summary.buyingStageLabel}</span> : null}
          {summary.personalizationScore != null ? <span>Score {summary.personalizationScore}</span> : null}
          {summary.createdAt ? <span>{formatPersonalizationDraftTimestamp(summary.createdAt)}</span> : null}
        </div>
      ) : null}

      {showPreview && summary ? (
        <div className="mb-2">
          <GrowthPersonalizationPreviewCard summary={summary} compact={compact} />
        </div>
      ) : null}

      {showStage && summary ? (
        <div className="mb-2">
          <GrowthPersonalizationStageCard summary={summary} compact={compact} />
        </div>
      ) : null}

      {summary?.reasoningObjective ? (
        <p className="mb-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Objective:</span> {summary.reasoningObjective}
        </p>
      ) : null}

      {summary?.nextBestAction ? (
        <p className="mb-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Next best action:</span> {summary.nextBestAction}
        </p>
      ) : null}

      {generating ? (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Generating personalized draft…
        </div>
      ) : null}

      <GrowthPersonalizationActions
        leadId={leadId}
        generationId={summary?.generationId}
        generating={generating}
        showApprove={showApprove}
        showEdit={showEdit}
        onGenerate={onGenerate}
        onRegenerate={onRegenerate}
        onApprove={onApprove}
        onEdit={onEdit}
        compact={compact}
      />
    </section>
  )
}
