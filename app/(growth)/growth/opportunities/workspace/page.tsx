"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, Target } from "lucide-react"
import { GrowthOpportunitiesOperatorDashboardBody } from "@/components/growth/opportunities/growth-opportunities-operator-dashboard-body"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { Button } from "@/components/ui/button"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthOpportunitiesWorkspacePage() {
  const pathname = usePathname()

  return (
    <GrowthWorkspacePageContent>
      <GrowthWorkspacePageHeader
        title="Opportunity Workspace"
        description="Evidence-backed opportunity signals, buying momentum, committee intelligence, and operator recommendations — no autonomous deal progression."
        icon={Target}
        iconClassName="bg-violet-50 text-violet-600"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={growthFeaturePath(pathname, "opportunities")}>
              <ArrowLeft className="mr-2 size-4" />
              Opportunities hub
            </Link>
          </Button>
        }
      />

      <GrowthOpportunitiesOperatorDashboardBody />
    </GrowthWorkspacePageContent>
  )
}
