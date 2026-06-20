"use client"

import { Sparkles } from "lucide-react"
import { GrowthSendrWorkspaceHome } from "@/components/growth/sendr/growth-sendr-workspace-home"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthSendrPage() {
  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="SENDR"
        description="Personalized landing pages — create, attach media & booking, preview variables, publish manually."
        icon={Sparkles}
        iconClassName="bg-fuchsia-50 text-fuchsia-600"
      />
      <GrowthSendrWorkspaceHome />
    </GrowthWorkspacePageContent>
  )
}
