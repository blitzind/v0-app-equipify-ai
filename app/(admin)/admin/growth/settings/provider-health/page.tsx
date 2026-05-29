"use client"

import { Activity } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthProspectSearchProviderHealthDashboard } from "@/components/growth/growth-prospect-search-provider-health-dashboard"
import { GrowthPdlProviderHealthDashboard } from "@/components/growth/growth-pdl-provider-health-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthProviderHealthPage() {
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
            <span className="flex size-9 items-center justify-center rounded-full bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
              <Activity size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Provider Health</h1>
              <p className="text-sm text-muted-foreground">
                Operational visibility into live discovery infrastructure — keys, cache, runs, and diagnostics.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <div className="space-y-8">
            <GrowthProspectSearchProviderHealthDashboard />
            <GrowthPdlProviderHealthDashboard />
          </div>
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
