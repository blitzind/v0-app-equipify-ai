"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, Target } from "lucide-react"
import { GrowthOpportunityWorkspaceDashboard } from "@/components/growth/growth-opportunity-workspace-dashboard"
import { GrowthOperatorExecutionWorkspaceV2Section } from "@/components/growth/growth-operator-execution-workspace-v2"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { Button } from "@/components/ui/button"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"

export function GrowthOpportunitiesOperatorWorkspace({ showPageHeader = true }: { showPageHeader?: boolean }) {
  const pathname = usePathname()

  return (
    <>
      {showPageHeader ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                <Target size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Opportunity Workspace</h1>
                <p className="text-sm text-muted-foreground">
                  Evidence-backed opportunity signals, buying momentum, committee intelligence, and operator
                  recommendations — no autonomous deal progression.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={growthFeaturePath(pathname, "opportunities")}>
                <ArrowLeft className="mr-2 size-4" />
                Readiness view
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      <GrowthSectionLayout>
        <GrowthOperatorExecutionWorkspaceV2Section />
        <GrowthOpportunityWorkspaceDashboard />
      </GrowthSectionLayout>
    </>
  )
}
