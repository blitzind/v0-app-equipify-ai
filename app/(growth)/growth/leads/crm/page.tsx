"use client"

import { Target } from "lucide-react"
import { GrowthLeadsCrmWorkspace } from "@/components/growth/leads/growth-leads-crm-workspace"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"

export default function GrowthLeadsCrmPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <GrowthWorkspacePageHeader
        title="CRM Growth Leads"
        description="Legacy CRM lead records — separate from the Revenue Queue workspace."
        icon={Target}
        iconClassName="bg-emerald-50 text-emerald-600"
      />

      <GrowthLeadsCrmWorkspace showPageHeader={false} />
    </div>
  )
}
