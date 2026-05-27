"use client"

import { Radar } from "lucide-react"
import Link from "next/link"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthInternalOutboundOperationsDashboardView } from "@/components/growth/growth-internal-outbound-operations-dashboard"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { Button } from "@/components/ui/button"
import { GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER } from "@/lib/growth/deliverability/deliverability-intelligence-types"

export default function AdminGrowthInternalOutboundOperationsPage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div
        className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8"
        data-qa-marker={GROWTH_DELIVERABILITY_INTELLIGENCE_QA_MARKER}
      >
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <Radar size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Internal Outbound Operations</h1>
                <p className="text-sm text-muted-foreground">
                  Equipify internal sales infrastructure — mailboxes, domains, sender pools, queues, and deliverability.
                  Platform admin only. Not customer-facing provisioning.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/admin/growth/infrastructure">Infrastructure</Link>
            </Button>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthInternalOutboundOperationsDashboardView />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
