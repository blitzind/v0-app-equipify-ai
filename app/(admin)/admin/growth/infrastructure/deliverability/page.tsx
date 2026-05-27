"use client"

import { ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthInfrastructureReadinessStrip } from "@/components/growth/growth-infrastructure-readiness-strip"
import { GrowthDeliverabilityDashboard } from "@/components/growth/growth-deliverability-dashboard"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { Button } from "@/components/ui/button"

export default function AdminGrowthDeliverabilityPage() {
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
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <ShieldCheck size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Deliverability</h1>
                <p className="text-sm text-muted-foreground">
                  DNS validation intelligence, authentication coverage, and deliverability risk monitoring — infrastructure only.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/admin/growth/infrastructure/mailboxes">Back to Mailbox Connections</Link>
            </Button>
          </div>
        </section>

        <GrowthInfrastructureReadinessStrip surfaceId="dns_validation" title="DNS validation" />
        <GrowthInfrastructureReadinessStrip surfaceId="deliverability" title="Deliverability intelligence" />

        <GrowthSectionLayout>
          <GrowthDeliverabilityDashboard />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
