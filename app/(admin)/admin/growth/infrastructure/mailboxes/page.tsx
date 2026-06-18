"use client"

import { Suspense } from "react"
import { Mail } from "lucide-react"
import Link from "next/link"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthInfrastructureReadinessStrip } from "@/components/growth/growth-infrastructure-readiness-strip"
import { GrowthConnectedMailboxesDashboard } from "@/components/growth/mailboxes/growth-connected-mailboxes-dashboard"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { Button } from "@/components/ui/button"

export default function AdminGrowthMailboxConnectionsPage() {
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
              <span className="flex size-9 items-center justify-center rounded-full bg-violet-50 text-violet-700">
                <Mail size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Connected Mailboxes</h1>
                <p className="text-sm text-muted-foreground">
                  Operational dashboard for Gmail mailboxes — connection health, warmup, pools, and daily send capacity.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" asChild>
                <Link href="/admin/growth/infrastructure/mailboxes/onboard">Onboard mailbox</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/admin/growth/infrastructure">Back to Infrastructure</Link>
              </Button>
            </div>
          </div>
        </section>

        <GrowthInfrastructureReadinessStrip
          surfaceId="mailbox_provider"
          title="Google mailbox path"
          matchTitle="Google mailbox (primary)"
        />

        <GrowthSectionLayout>
          <Suspense
            fallback={
              <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
                Loading mailbox connections…
              </div>
            }
          >
            <GrowthConnectedMailboxesDashboard />
          </Suspense>
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
