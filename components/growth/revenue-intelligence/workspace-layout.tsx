"use client"

import type { ReactNode } from "react"
import type { GrowthLeadOperatorWorkspacePayload } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { ExecutiveSummaryCard } from "@/components/growth/revenue-intelligence/executive-summary-card"
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
    </div>
  )
}
