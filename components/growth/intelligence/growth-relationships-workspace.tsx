"use client"

import { Handshake } from "lucide-react"
import { GrowthRelationshipDashboard } from "@/components/growth/growth-relationship-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export function GrowthRelationshipsWorkspace({ showPageHeader = true }: { showPageHeader?: boolean }) {
  return (
    <>
      {showPageHeader ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <Handshake size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Relationship Intelligence</h1>
              <p className="text-sm text-muted-foreground">
                Meaningful touch depth, relationship strength tiers, executive attention signals, and queue
                prioritization — read-only intelligence, no send.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <GrowthSectionLayout>
        <GrowthRelationshipDashboard />
      </GrowthSectionLayout>
    </>
  )
}
