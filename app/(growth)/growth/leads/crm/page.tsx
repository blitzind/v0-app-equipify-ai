"use client"

import { Suspense } from "react"
import { Target } from "lucide-react"
import { GrowthLeadsCrmWorkspace } from "@/components/growth/leads/growth-leads-crm-workspace"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthLeadsCrmPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Lead Records"
        description="Existing lead records — separate from the Revenue Queue workspace."
        icon={Target}
        iconClassName="bg-emerald-50 text-emerald-600"
      />

      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Loading lead records…</p>
        }
      >
        <GrowthLeadsCrmWorkspace showPageHeader={false} />
      </Suspense>
    </GrowthWorkspacePageContent>
  )
}
