"use client"

import { GitBranch } from "lucide-react"
import { GrowthOpportunityPipelineDashboard } from "@/components/growth/growth-opportunity-pipeline-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export function GrowthOpportunitiesPipelineWorkspace({ showPageHeader = true }: { showPageHeader?: boolean }) {
  return (
    <>
      {showPageHeader ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <GitBranch size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Opportunity Pipeline</h1>
              <p className="text-sm text-muted-foreground">
                Deal operating system — pipeline stages, forecast categories, weighted revenue, and human-controlled close
                workflows.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <GrowthSectionLayout>
        <GrowthOpportunityPipelineDashboard />
      </GrowthSectionLayout>
    </>
  )
}
