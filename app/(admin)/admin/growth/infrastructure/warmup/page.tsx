"use client"

import { Flame } from "lucide-react"
import Link from "next/link"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthInfrastructureReadinessStrip } from "@/components/growth/growth-infrastructure-readiness-strip"
import { GrowthWarmupDashboardPanel } from "@/components/growth/growth-warmup-dashboard"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { Button } from "@/components/ui/button"

export default function AdminGrowthWarmupPage() {
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
              <span className="flex size-9 items-center justify-center rounded-full bg-orange-50 text-orange-700">
                <Flame size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Warmup</h1>
                <p className="text-sm text-muted-foreground">
                  Deterministic warmup scheduling and health monitoring — infrastructure only, no outbound execution.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/admin/growth/infrastructure/deliverability">Back to Deliverability</Link>
            </Button>
          </div>
        </section>

        <GrowthInfrastructureReadinessStrip surfaceId="warmup" title="Mailbox warmup" />

        <GrowthSectionLayout>
          <GrowthWarmupDashboardPanel />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
