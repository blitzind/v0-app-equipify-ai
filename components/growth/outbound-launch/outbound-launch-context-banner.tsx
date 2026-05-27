"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { parseOutboundLaunchWorkflowContext } from "@/lib/growth/outbound-launch/outbound-launch-motion"
import { summarizeGrowthWorkflowContext } from "@/lib/growth/prospect-search/prospect-workflow-context"

export function OutboundLaunchContextBanner({ className }: { className?: string }) {
  const searchParams = useSearchParams()
  const context = useMemo(
    () => parseOutboundLaunchWorkflowContext(searchParams),
    [searchParams],
  )

  if (!context) return null

  return (
    <div
      className={
        className ??
        "rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 text-xs text-violet-950 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-100"
      }
      data-outbound-launch-context="v1"
    >
      <p className="font-semibold">Launch context from Prospect Search</p>
      <p className="mt-0.5 text-muted-foreground">{summarizeGrowthWorkflowContext(context)}</p>
      {context.recommendation?.recommended_workflow_path ? (
        <p className="mt-1 text-[11px]">{context.recommendation.recommended_workflow_path}</p>
      ) : null}
      {context.outreach_state.is_suppressed ? (
        <p className="mt-1 text-rose-800">Suppressed — outbound blocked until operator review.</p>
      ) : null}
    </div>
  )
}
