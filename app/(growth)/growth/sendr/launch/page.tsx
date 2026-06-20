"use client"

import { Rocket } from "lucide-react"
import { GrowthSendrLaunchWizard } from "@/components/growth/sendr/growth-sendr-launch-wizard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthSendrLaunchPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="SENDR Launch"
        description="Guided operator workflow — audience, sequence, SENDR page, preview, confirm, enroll. No autonomous sends."
        icon={Rocket}
        iconClassName="bg-fuchsia-50 text-fuchsia-600"
      />
      <GrowthSendrLaunchWizard />
    </GrowthWorkspacePageContent>
  )
}
