"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Target } from "lucide-react"
import { GrowthOpportunityDashboard } from "@/components/growth/growth-opportunity-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { Button } from "@/components/ui/button"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"

export function GrowthOpportunitiesReadinessWorkspace({ showPageHeader = true }: { showPageHeader?: boolean }) {
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
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Opportunity Readiness</h1>
                <p className="text-sm text-muted-foreground">
                  Sales-motion readiness scoring with blockers, accelerators, and executive close candidates — read-only
                  intelligence, no send.
                </p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href={growthFeaturePath(pathname, "opportunities/workspace")}>Opportunity workspace</Link>
            </Button>
          </div>
        </section>
      ) : null}

      <GrowthSectionLayout>
        <GrowthOpportunityDashboard />
      </GrowthSectionLayout>
    </>
  )
}
