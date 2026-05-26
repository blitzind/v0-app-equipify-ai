"use client"

import { Search } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthProspectSearchAdmin } from "@/components/growth/prospect-search/growth-prospect-search-admin"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import {
  GROWTH_PROSPECT_SEARCH_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_UX_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-admin-types"

export default function AdminGrowthProspectSearchPage() {
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
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
              <Search size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Prospect Search</h1>
              <p className="text-sm text-muted-foreground">
                Apollo-style discovery over your Growth Engine index — ICP filters, saved searches, lists, and operator actions. Infrastructure only; no scraping or outbound.
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {GROWTH_PROSPECT_SEARCH_QA_MARKER} · {GROWTH_PROSPECT_SEARCH_UX_QA_MARKER}
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthProspectSearchAdmin />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
