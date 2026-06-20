"use client"

import { use } from "react"
import { Sparkles } from "lucide-react"
import { GrowthSendrPageDetail } from "@/components/growth/sendr/growth-sendr-page-detail"
import { GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL } from "@/lib/growth/sendr/growth-sendr-branding"
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
        title={GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL}
        description="Sections, personalization preview, media & booking attachment, publish."
        icon={Sparkles}
        iconClassName="bg-fuchsia-50 text-fuchsia-600"
      />
      <GrowthSendrPageDetail pageId={pageId} />
    </GrowthWorkspacePageContent>
  )
}
