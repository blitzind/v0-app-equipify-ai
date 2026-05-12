"use client"

import { useOrgPermissions } from "@/lib/org-permissions-context"
import { AiOpsPage } from "@/components/ai-ops/ai-ops-page"
import { Brain } from "lucide-react"

/**
 * AI Operational Assistant — Phase 1 page entry.
 *
 * Visible to anyone with `canViewInsights`; the rule engine itself
 * narrows surfaced recommendations by per-category permissions
 * (`canViewFinancials`, `canManageProspects`, etc.) so techs and
 * viewers see only operational hints relevant to their role.
 */
export default function AiOperationsRoutePage() {
  const { permissions } = useOrgPermissions()
  if (!permissions.canViewInsights) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <Brain className="h-6 w-6 mx-auto text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold mt-3">AI Operations is restricted</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
          Ask an owner, admin, or manager to grant you insights access to view operational
          recommendations.
        </p>
      </div>
    )
  }
  return <AiOpsPage />
}
