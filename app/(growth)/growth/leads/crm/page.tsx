"use client"

import { Target } from "lucide-react"
import { GrowthLeadsCrmWorkspace } from "@/components/growth/leads/growth-leads-crm-workspace"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthLeadsCrmPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="CRM Growth Leads"
        description="Legacy CRM lead records — separate from the Revenue Queue workspace."
        icon={Target}
        iconClassName="bg-emerald-50 text-emerald-600"
      />

      <GrowthLeadsCrmWorkspace showPageHeader={false} />
    </GrowthWorkspacePageContent>
  )
}
