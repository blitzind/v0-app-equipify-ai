"use client"

import Link from "next/link"
import { Target } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthOpportunitiesReadinessDashboardBody } from "@/components/growth/opportunities/growth-opportunities-readiness-dashboard-body"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { Button } from "@/components/ui/button"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthOpportunitiesPage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <PlatformAdminTabNav activeKey="growth_leads" />

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
              <Link href="/admin/growth/opportunities/workspace">Opportunity workspace</Link>
            </Button>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthOpportunitiesReadinessDashboardBody />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
