"use client"

import { use } from "react"
import { GrowthLeadOperatorWorkspace } from "@/components/growth/lead-operator/growth-lead-operator-workspace"
import { useGrowthBreadcrumbDetail } from "@/components/growth/shell/growth-breadcrumb-context"

type PageProps = { params: Promise<{ leadId: string }> }

export default function GrowthLeadOperatorPage({ params }: PageProps) {
  const { leadId } = use(params)
  useGrowthBreadcrumbDetail(leadId)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthLeadOperatorWorkspace leadId={leadId} />
    </div>
  )
}
