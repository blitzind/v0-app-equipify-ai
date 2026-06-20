"use client"

import { use } from "react"
import { Sparkles } from "lucide-react"
import { GrowthSendrPageDetail } from "@/components/growth/sendr/growth-sendr-page-detail"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthSendrPageDetailRoute({
  params,
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = use(params)

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="SENDR Page"
        description="Sections, personalization preview, media & booking attachment, publish."
        icon={Sparkles}
        iconClassName="bg-fuchsia-50 text-fuchsia-600"
      />
      <GrowthSendrPageDetail pageId={pageId} />
    </GrowthWorkspacePageContent>
  )
}
