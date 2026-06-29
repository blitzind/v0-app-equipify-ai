"use client"

import type { CommunicationStrategyDisplaySummary } from "@/lib/growth/contact-verification/communication-strategy-view"
import { isCommunicationStrategyEnabledClient } from "@/lib/growth/contact-verification/communication-strategy-feature"
import type { NativeRevenueDecisionDisplaySummary } from "@/lib/growth/contact-verification/native-revenue-decision-adapter"
import { isNativeRevenueDecisionEngineEnabledClient } from "@/lib/growth/contact-verification/native-revenue-decision-feature"
import { GROWTH_NEXT_BEST_ACTION_LABELS, type GrowthNextBestAction } from "@/lib/growth/nba-types"
import type { GrowthLead } from "@/lib/growth/types"
import { cn } from "@/lib/utils"

type GrowthNextBestActionBannerProps = {
  lead: GrowthLead
  nativeDecision?: NativeRevenueDecisionDisplaySummary | null
  nativeCommunicationStrategy?: CommunicationStrategyDisplaySummary | null
}

function actionClass(action: GrowthNextBestAction | null): string {
  switch (action) {
    case "call_primary_contact":
    case "call_decision_maker":
    case "retry_call":
      return "border-emerald-200 bg-emerald-50 text-emerald-950"
    case "run_research":
    case "refresh_research":
    case "fix_website_research":
      return "border-sky-200 bg-sky-50 text-sky-950"
    case "find_decision_maker":
      return "border-amber-200 bg-amber-50 text-amber-950"
    case "wait_follow_up":
      return "border-violet-200 bg-violet-50 text-violet-950"
    case "review_disqualified":
      return "border-slate-200 bg-slate-50 text-slate-700"
    default:
      return "border-border bg-muted/30 text-foreground"
  }
}

export function GrowthNextBestActionBanner({
  lead,
  nativeDecision,
  nativeCommunicationStrategy,
}: GrowthNextBestActionBannerProps) {
  const useStrategy =
    isCommunicationStrategyEnabledClient() && nativeCommunicationStrategy != null
  const useNative = isNativeRevenueDecisionEngineEnabledClient() && nativeDecision != null

  const action = useNative || useStrategy ? null : lead.nextBestAction
  const label = useStrategy
    ? nativeCommunicationStrategy.recommended_action_label
    : useNative
      ? nativeDecision.action_label
      : action
        ? GROWTH_NEXT_BEST_ACTION_LABELS[action]
        : "No next action computed yet"
  const reason = useStrategy
    ? nativeCommunicationStrategy.reasoning[0] ??
      `${nativeCommunicationStrategy.primary_channel_label} · ${nativeCommunicationStrategy.confidence}% confidence`
    : useNative
      ? nativeDecision.reasons[0] ??
        `Native engine · ${nativeDecision.execution_readiness} · ${nativeDecision.recommended_delay_label}`
      : lead.nextBestActionReason ?? "Run research or refresh workflow signals."

  return (
    <div className={cn("rounded-xl border px-4 py-3", actionClass(action))}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {useStrategy ? "Communication strategy" : "Next best action"}
      </p>
      <p className="mt-1 text-base font-semibold">{label}</p>
      <p className="mt-1 text-sm opacity-90">{reason}</p>
      {useStrategy ? (
        <p className="mt-2 text-xs opacity-75">
          Primary channel: {nativeCommunicationStrategy.primary_channel_label}
          {nativeCommunicationStrategy.fallback_channels.length > 0
            ? ` · Then: ${nativeCommunicationStrategy.fallback_channels.slice(0, 3).join(", ")}`
            : ""}
          {nativeCommunicationStrategy.requires_human_approval ? " · Requires approval" : ""}
        </p>
      ) : useNative ? (
        <p className="mt-2 text-xs opacity-75">
          Native decision · {nativeDecision.priority} priority · {nativeDecision.confidence}% confidence
        </p>
      ) : lead.decisionMakerStatus ? (
        <p className="mt-2 text-xs opacity-75">
          Decision maker status: {lead.decisionMakerStatus.replace(/_/g, " ")}
        </p>
      ) : null}
    </div>
  )
}
