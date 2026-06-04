"use client"

import Link from "next/link"
import { TrendingUp } from "lucide-react"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { executionPlanProgress } from "@/lib/growth/inbox/inbox-revenue-context"
import { GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"
import { GROWTH_REVENUE_EXECUTION_QA_MARKER } from "@/lib/growth/revenue-execution/revenue-execution-types"
import { revenueReadinessTierLabel } from "@/lib/growth/revenue-workflow/revenue-workflow-types"
import { relationshipStageLabel } from "@/lib/growth/lead-memory/memory-types"

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border/60 bg-background/80 px-2 py-1">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-medium">{value}</p>
    </div>
  )
}

export function GrowthInboxInlineRevenueContext() {
  const {
    leadId,
    revenueReadiness,
    forecastEvidence,
    executionPlan,
    playbook,
    memoryProfile,
    loading,
  } = useGrowthInboxLeadContext()

  if (!leadId) return null

  const planProgress = executionPlanProgress(executionPlan)
  const relationshipStage = memoryProfile?.profile?.relationshipStage
  const engagementTrend =
    memoryProfile?.relationshipContext?.engagementTrend ?? forecastEvidence?.engagementTrend ?? "—"

  return (
    <section
      className="border-b border-border bg-muted/15 px-4 py-2"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revenue Context</h3>
          <span className="text-[10px] text-muted-foreground" data-equipify-qa-marker={GROWTH_REVENUE_EXECUTION_QA_MARKER}>
            {GROWTH_REVENUE_EXECUTION_QA_MARKER}
          </span>
        </div>
        <Link
          href={`/admin/growth/revenue-execution/review${forecastEvidence ? `?leadId=${encodeURIComponent(leadId)}` : ""}`}
          className="text-[10px] font-medium text-indigo-600 hover:underline"
        >
          Open revenue execution
        </Link>
      </div>

      {loading && !revenueReadiness && !forecastEvidence ? (
        <p className="text-xs text-muted-foreground">Loading revenue context…</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <MetricChip
            label="Revenue Readiness"
            value={
              revenueReadiness
                ? `${revenueReadiness.score} · ${revenueReadinessTierLabel(revenueReadiness.tier)}`
                : forecastEvidence?.revenueReadinessScore != null
                  ? `${forecastEvidence.revenueReadinessScore} · ${forecastEvidence.revenueReadinessTier ?? "—"}`
                  : "—"
            }
          />
          <MetricChip
            label="Opportunity Score"
            value={
              forecastEvidence?.opportunityRecommendationScore != null
                ? String(forecastEvidence.opportunityRecommendationScore)
                : "—"
            }
          />
          <MetricChip
            label="Confidence"
            value={
              forecastEvidence?.opportunityConfidence != null
                ? `${Math.round(forecastEvidence.opportunityConfidence)}%`
                : "—"
            }
          />
          <MetricChip label="Engagement Trend" value={engagementTrend} />
          <MetricChip
            label="Relationship Stage"
            value={relationshipStage ? relationshipStageLabel(relationshipStage) : forecastEvidence?.relationshipStage ?? "—"}
          />
          <MetricChip label="Revenue Playbook" value={playbook?.title ?? "—"} />
          <MetricChip
            label="Execution Plan"
            value={
              planProgress.total > 0
                ? `${planProgress.completed}/${planProgress.total}${planProgress.nextStep ? ` · ${planProgress.nextStep}` : ""}`
                : "Not generated"
            }
          />
        </div>
      )}

      {playbook ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <GrowthBadge label={playbook.key.replace(/_/g, " ")} tone="attention" />
          <p className="text-[11px] text-muted-foreground">{playbook.recommendedNextStep}</p>
        </div>
      ) : null}
    </section>
  )
}
