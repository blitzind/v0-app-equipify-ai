"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ArrowLeft, FileText } from "lucide-react"
import { GrowthSharePageOperatorWorkspace } from "@/components/growth/share-pages/growth-share-page-operator-workspace"
import { GrowthSharePagesWorkspaceTabs } from "@/components/growth/share-pages/growth-share-pages-workspace-tabs"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { Button } from "@/components/ui/button"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"

export default function AdminGrowthSharePagesWorkspacePage() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const leadId = searchParams.get("lead_id")
  const pageId = searchParams.get("page_id")

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Share Page Operator Workspace"
        description="Review personalized share pages, approve drafts, publish passively, and inspect engagement — no sends, enrollments, or automation execution."
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
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Open this workspace with <code>?lead_id=</code> and optional <code>?page_id=</code> to review share pages
          for a lead.
        </div>
      )}
    </GrowthWorkspacePageContent>
  )
}
