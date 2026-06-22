"use client"

import { Settings2 } from "lucide-react"
import Link from "next/link"
import { useAdmin } from "@/lib/admin-store"
import { GrowthProviderSetupDashboard } from "@/components/growth/growth-provider-setup-dashboard"
import { GrowthInfrastructureReadinessStrip } from "@/components/growth/growth-infrastructure-readiness-strip"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { Button } from "@/components/ui/button"

export default function AdminGrowthProviderSetupPage() {
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
              <span className="flex size-9 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                <Settings2 size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Provider Setup</h1>
                <p className="text-sm text-muted-foreground">
                  Live OAuth, credentials, webhooks, readiness checks, and human-confirmed test sends. Growth Engine
                  orchestrates — providers transport only.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/admin/growth/providers/delivery">Delivery Dashboard</Link>
            </Button>
          </div>
        </section>

        <GrowthInfrastructureReadinessStrip
          surfaceId="mailbox_provider"
          title="Google mailbox provider"
          matchTitle="Google mailbox (primary)"
        />

        <GrowthSectionLayout>
          <GrowthProviderSetupDashboard variant="admin" oauthReturnTo="/admin/growth/providers/setup" />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
