"use client"

import { GitBranch } from "lucide-react"
import { GrowthReplyWorkflowActionCenter } from "@/components/growth/growth-reply-workflow-actions-panel"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export function GrowthReplyWorkflowWorkspace({ showPageHeader = true }: { showPageHeader?: boolean }) {
  return (
    <>
      {showPageHeader ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <GitBranch size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Sales Workflow Actions</h1>
              <p className="text-sm text-muted-foreground">
                Reply-generated recommendations — mark interested, create call tasks, review opportunities, and
                resolve sequence exits. All actions require operator confirmation.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <GrowthSectionLayout>
        <GrowthReplyWorkflowActionCenter />
      </GrowthSectionLayout>
    </>
  )
}
