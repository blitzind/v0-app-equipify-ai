"use client"

import { Sparkles } from "lucide-react"
import { AidenActionCenterPage } from "@/components/aiden/action-center/aiden-action-center-page"
import { useOrgPermissions } from "@/lib/org-permissions-context"

/**
 * Workspace-wide list of AI-prepared AIden actions (lifecycle, filters, detail drawer).
 * Gated by insights access so it sits alongside other Automation & Intelligence surfaces.
 */
export default function AidenActionsRoutePage() {
  const { permissions } = useOrgPermissions()
  if (!permissions.canViewInsights) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden strokeWidth={2} />
        <h2 className="mt-3 text-sm font-semibold">AIden Action Center is restricted</h2>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          Ask an owner, admin, or manager to grant you insights access to view AI-prepared AIden actions for this
          workspace.
        </p>
      </div>
    )
  }
  return <AidenActionCenterPage />
}
