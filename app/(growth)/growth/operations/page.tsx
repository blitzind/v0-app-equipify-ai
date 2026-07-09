"use client"

import { Briefcase } from "lucide-react"
import { GrowthSalesOperationsCenterDashboard } from "@/components/growth/operations-center/growth-sales-operations-center-dashboard"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { useGrowthWorkspaceDashboard } from "@/components/growth/workspace/use-growth-workspace-dashboard"
import { Skeleton } from "@/components/ui/skeleton"
import { useAiTeammateIdentity } from "@/components/growth/ai-teammate/ai-teammate-identity-provider"
import { teammateOperationsPageDescription } from "@/lib/workspace/ai-teammate-voice"

export default function GrowthSalesOperationsCenterPage() {
  const { dashboard, workspaceSummary, loading, error } = useGrowthWorkspaceDashboard()
  const { teammate } = useAiTeammateIdentity()

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Sales Operations Center"
        description={teammateOperationsPageDescription(teammate)}
        icon={Briefcase}
        iconClassName="bg-violet-50 text-violet-600"
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : dashboard && workspaceSummary ? (
        <GrowthSalesOperationsCenterDashboard dashboard={dashboard} workspaceSummary={workspaceSummary} />
      ) : (
        <p className="text-sm text-muted-foreground">Workspace runtime is not available yet.</p>
      )}
    </GrowthWorkspacePageContent>
  )
}
