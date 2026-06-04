"use client"

import Link from "next/link"
import { TrendingUp } from "lucide-react"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { executionPlanProgress } from "@/lib/growth/inbox/inbox-revenue-context"
import { GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER } from "@/lib/growth/inbox/inbox-workspace-types"
import { revenueReadinessTierLabel } from "@/lib/growth/revenue-workflow/revenue-workflow-types"
import { relationshipStageLabel } from "@/lib/growth/lead-memory/memory-types"

function CompactChip({ label, value }: { label: string; value: string }) {
  if (!value || value === "—" || value === "Not generated") return null
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/50 bg-background/80 px-2 py-0.5 text-[10px]"
      title={`${label}: ${value}`}
    >
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="max-w-[120px] truncate">{value}</span>
    </span>
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
    memoryProfile?.relationshipContext?.engagementTrend ?? forecastEvidence?.engagementTrend ?? null

  const readinessValue = revenueReadiness
    ? `${revenueReadiness.score} · ${revenueReadinessTierLabel(revenueReadiness.tier)}`
    : forecastEvidence?.revenueReadinessScore != null
      ? `${forecastEvidence.revenueReadinessScore} · ${forecastEvidence.revenueReadinessTier ?? "—"}`
      : null

  const chips = [
    readinessValue ? { label: "Readiness", value: readinessValue } : null,
    forecastEvidence?.opportunityRecommendationScore != null
      ? { label: "Opp", value: String(forecastEvidence.opportunityRecommendationScore) }
      : null,
    forecastEvidence?.opportunityConfidence != null
      ? { label: "Conf", value: `${Math.round(forecastEvidence.opportunityConfidence)}%` }
      : null,
    engagementTrend ? { label: "Trend", value: engagementTrend } : null,
    relationshipStage || forecastEvidence?.relationshipStage
      ? {
          label: "Stage",
          value: relationshipStage
            ? relationshipStageLabel(relationshipStage)
            : (forecastEvidence?.relationshipStage ?? ""),
        }
      : null,
    playbook?.title ? { label: "Playbook", value: playbook.title } : null,
    planProgress.total > 0
      ? {
          label: "Plan",
          value: `${planProgress.completed}/${planProgress.total}${planProgress.nextStep ? ` · ${planProgress.nextStep}` : ""}`,
        }
      : null,
  ].filter((chip): chip is { label: string; value: string } => chip != null)

  return (
    <section
      className="shrink-0 border-b border-border/60 bg-muted/10 px-3 py-1.5"
      data-equipify-qa-marker={GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="size-3 text-muted-foreground" />
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Revenue</h3>
        </div>
        <Link
          href={`/admin/growth/revenue-execution/review${forecastEvidence ? `?leadId=${encodeURIComponent(leadId)}` : ""}`}
          className="text-[9px] font-medium text-indigo-600 hover:underline"
        >
          Open review
        </Link>
      </div>

      {loading && chips.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Loading revenue context…</p>
      ) : chips.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No revenue context yet.</p>
      ) : (
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {chips.map((chip) => (
            <CompactChip key={chip.label} label={chip.label} value={chip.value} />
          ))}
        </div>
      )}
    </section>
  )
}
