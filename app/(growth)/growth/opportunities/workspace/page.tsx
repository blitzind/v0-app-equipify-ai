"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, Target } from "lucide-react"
import { GrowthOpportunitiesOperatorDashboardBody } from "@/components/growth/opportunities/growth-opportunities-operator-dashboard-body"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { Button } from "@/components/ui/button"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"

export default function GrowthOpportunitiesWorkspacePage() {
  const pathname = usePathname()

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
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
    </div>
  )
}
