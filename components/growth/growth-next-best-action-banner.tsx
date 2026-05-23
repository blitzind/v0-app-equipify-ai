"use client"

import { GROWTH_NEXT_BEST_ACTION_LABELS, type GrowthNextBestAction } from "@/lib/growth/nba-types"
import type { GrowthLead } from "@/lib/growth/types"
import { cn } from "@/lib/utils"

type GrowthNextBestActionBannerProps = {
  lead: GrowthLead
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

export function GrowthNextBestActionBanner({ lead }: GrowthNextBestActionBannerProps) {
  const action = lead.nextBestAction
  const label = action ? GROWTH_NEXT_BEST_ACTION_LABELS[action] : "No next action computed yet"
  const reason = lead.nextBestActionReason ?? "Run research or refresh workflow signals."

  return (
    <div className={cn("rounded-xl border px-4 py-3", actionClass(action))}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Next best action</p>
      <p className="mt-1 text-base font-semibold">{label}</p>
      <p className="mt-1 text-sm opacity-90">{reason}</p>
      {lead.decisionMakerStatus ? (
        <p className="mt-2 text-xs opacity-75">
          Decision maker status: {lead.decisionMakerStatus.replace(/_/g, " ")}
        </p>
      ) : null}
    </div>
  )
}
