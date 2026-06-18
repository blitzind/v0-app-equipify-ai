"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthSharePageDetailPanel } from "@/components/growth/share-pages/growth-share-pages-admin-panel"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { useGrowthFeaturePath } from "@/lib/growth/navigation/use-growth-feature-path"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthSharePageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const listPath = useGrowthFeaturePath("share-pages")

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Share Page Detail"
        description="Review, preview, approve, and monitor engagement."
        icon={FileText}
        iconClassName="bg-emerald-50 text-emerald-600"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={listPath}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to list
            </Link>
          </Button>
        }
      />
      <GrowthSharePageDetailPanel sharePageId={id} />
    </GrowthWorkspacePageContent>
  )
}
