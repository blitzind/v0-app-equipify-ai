"use client"

import { ShieldAlert } from "lucide-react"
import Link from "next/link"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthReputationProtectionDashboardView } from "@/components/growth/growth-reputation-protection-dashboard"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { Button } from "@/components/ui/button"
import { GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_QA_MARKER } from "@/lib/growth/deliverability/reputation-protection-types"

export default function AdminGrowthDeliverabilityProtectionPage() {
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
        data-qa-marker={GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_QA_MARKER}
      >
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                <ShieldAlert size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>Deliverability Protection</h1>
                <p className="text-sm text-muted-foreground">
                  Mailbox reputation, send throttles, warmup guidance, and auditable governance for internal outbound.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/admin/growth/infrastructure/mailboxes">Mailbox connections</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/admin/growth/infrastructure/deliverability">DNS deliverability</Link>
              </Button>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthReputationProtectionDashboardView />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
