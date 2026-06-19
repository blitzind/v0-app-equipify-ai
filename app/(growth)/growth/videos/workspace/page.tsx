"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ArrowLeft, Clapperboard } from "lucide-react"
import { GrowthVideoOperatorWorkspace } from "@/components/growth/videos/growth-video-operator-workspace"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { Button } from "@/components/ui/button"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"

export default function GrowthVideosWorkspacePage() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const leadId = searchParams.get("lead_id")

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Video Operator Workspace"
        description="Review F1 recommendations and F2 draft packages in one place — metadata-only actions, no sends, enrollments, or worker execution."
        icon={Clapperboard}
        iconClassName="bg-violet-50 text-violet-600"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={growthFeaturePath(pathname, "videos")}>
              <ArrowLeft className="mr-2 size-4" />
              Videos hub
            </Link>
          </Button>
        }
      />

      {leadId ? (
        <GrowthVideoOperatorWorkspace leadId={leadId} />
      ) : (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          Open this workspace from a lead with <code>?lead_id=</code> in the URL to review autopilot draft
          packages.
        </div>
      )}
    </GrowthWorkspacePageContent>
  )
}
