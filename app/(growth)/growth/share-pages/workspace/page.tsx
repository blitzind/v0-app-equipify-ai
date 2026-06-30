"use client"

import Link from "next/link"
import { ArrowLeft, FileText } from "lucide-react"
import { GrowthSharePageOperatorWorkspace } from "@/components/growth/share-pages/growth-share-page-operator-workspace"
import { GrowthSharePagesWorkspaceProspectGate } from "@/components/growth/share-pages/growth-share-pages-workspace-prospect-gate"
import { GrowthSharePagesWorkspaceTabs } from "@/components/growth/share-pages/growth-share-pages-workspace-tabs"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { Button } from "@/components/ui/button"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import { resolveGrowthLeadIdFromSearchParams } from "@/lib/growth/navigation/growth-workspace-operator-links"
import { usePathname, useSearchParams } from "next/navigation"

export default function GrowthSharePagesWorkspacePage() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const leadId = resolveGrowthLeadIdFromSearchParams(searchParams)
  const pageId = searchParams.get("page_id")

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Share Pages Workspace"
        description="Review personalized share pages for a prospect — preview drafts, publish passively, and inspect engagement."
        icon={FileText}
        iconClassName="bg-emerald-50 text-emerald-600"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={growthFeaturePath(pathname, "share-pages")}>
              <ArrowLeft className="mr-2 size-4" />
              Share Pages hub
            </Link>
          </Button>
        }
      />

      <GrowthSharePagesWorkspaceTabs />

      {leadId ? (
        <GrowthSharePageOperatorWorkspace leadId={leadId} initialPageId={pageId} />
      ) : (
        <GrowthSharePagesWorkspaceProspectGate />
      )}
    </GrowthWorkspacePageContent>
  )
}
