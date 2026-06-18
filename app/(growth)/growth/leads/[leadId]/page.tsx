"use client"

import { use } from "react"
import { GrowthLeadOperatorWorkspace } from "@/components/growth/lead-operator/growth-lead-operator-workspace"
import { useGrowthBreadcrumbDetail } from "@/components/growth/shell/growth-breadcrumb-context"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

type PageProps = { params: Promise<{ leadId: string }> }

export default function GrowthLeadOperatorPage({ params }: PageProps) {
  const { leadId } = use(params)
  useGrowthBreadcrumbDetail(leadId)

  return (
    <GrowthWorkspacePageContent>
      <GrowthLeadOperatorWorkspace leadId={leadId} />
    </GrowthWorkspacePageContent>
  )
}
