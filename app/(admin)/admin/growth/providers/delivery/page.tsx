"use client"

import { Truck } from "lucide-react"
import Link from "next/link"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthInfrastructureReadinessStrip } from "@/components/growth/growth-infrastructure-readiness-strip"
import { GrowthProviderDeliveryDashboardPanel } from "@/components/growth/growth-provider-delivery-dashboard"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { Button } from "@/components/ui/button"
import {
  GROWTH_ADMIN_ROUTE_RUNTIME_STABLE_QA_MARKER,
  GROWTH_PROVIDER_DELIVERY_RUNTIME_STABLE_QA_MARKER,
} from "@/lib/growth/admin-route-runtime-types"

export default function AdminGrowthProviderDeliveryPage() {
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
        data-qa={GROWTH_ADMIN_ROUTE_RUNTIME_STABLE_QA_MARKER}
        data-qa-marker={GROWTH_PROVIDER_DELIVERY_RUNTIME_STABLE_QA_MARKER}
      >
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-violet-50 text-violet-700">
                <Truck size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Delivery</h1>
                <p className="text-sm text-muted-foreground">
                  Transport routing, delivery attempts, and provider health — live when simulation flags are off.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/admin/growth/providers">Provider Diagnostics</Link>
            </Button>
          </div>
        </section>

        <GrowthInfrastructureReadinessStrip surfaceId="transport_send" title="Transport send plane" />

        <GrowthSectionLayout>
          <GrowthProviderDeliveryDashboardPanel />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
