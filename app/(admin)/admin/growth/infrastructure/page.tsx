"use client"

import { Server } from "lucide-react"
import Link from "next/link"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthSenderInfrastructureDashboard } from "@/components/growth/growth-sender-infrastructure-dashboard"
import { GrowthInfrastructureReadinessStrip } from "@/components/growth/growth-infrastructure-readiness-strip"
import { GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER } from "@/lib/growth/operations/internal-outbound-ops-types"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { Button } from "@/components/ui/button"

export default function AdminGrowthInfrastructurePage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8" data-qa-marker={GROWTH_INTERNAL_OUTBOUND_OPS_QA_MARKER}>
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                <Server size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Sender Infrastructure</h1>
                <p className="text-sm text-muted-foreground">
                  Register sender identities, track domain health, and monitor reputation — infrastructure only, no sending.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/admin/growth/infrastructure/outbound-operations">Outbound Operations</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/admin/growth/infrastructure/mailboxes">Mailbox Connections</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/admin/growth/infrastructure/deliverability">Deliverability</Link>
              </Button>
            </div>
          </div>
        </section>

        <GrowthInfrastructureReadinessStrip surfaceId="transport_send" title="Outbound transport" />

        <GrowthSectionLayout>
          <GrowthSenderInfrastructureDashboard />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
