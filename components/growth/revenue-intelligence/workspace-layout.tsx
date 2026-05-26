"use client"

import type { ReactNode } from "react"
import type { GrowthLeadOperatorWorkspacePayload } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { ExecutiveSummaryCard } from "@/components/growth/revenue-intelligence/executive-summary-card"
import { GROWTH_REVENUE_INTELLIGENCE_UX_QA_MARKER } from "@/lib/growth/revenue-intelligence/revenue-intelligence-ux"

export function RevenueIntelligenceWorkspaceLayout({
  workspace,
  actions,
  children,
}: {
  workspace: GrowthLeadOperatorWorkspacePayload
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="space-y-6">
      {actions}
      <ExecutiveSummaryCard workspace={workspace} />
      {children}
      <p className="font-mono text-xs text-muted-foreground">
        {workspace.qa_marker} · {GROWTH_REVENUE_INTELLIGENCE_UX_QA_MARKER}
      </p>
    </div>
  )
}
