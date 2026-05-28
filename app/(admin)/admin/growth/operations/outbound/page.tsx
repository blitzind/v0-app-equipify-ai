"use client"

import { Radar } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthOutboundOperationsDashboard } from "@/components/growth/growth-outbound-operations-dashboard"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { GROWTH_CRON_TELEMETRY_QA_MARKER } from "@/lib/growth/runtime/cron-telemetry-types"
import { GROWTH_OPERATOR_UX_H3_QA_MARKER } from "@/lib/growth/operator-ux/operator-ux-h3-types"

export default function AdminGrowthOutboundOperationsPage() {
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
        data-qa-marker={GROWTH_CRON_TELEMETRY_QA_MARKER}
        data-h3-qa={GROWTH_OPERATOR_UX_H3_QA_MARKER}
      >
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Radar size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Outbound Console</h1>
              <p className="text-sm text-muted-foreground">
                Daily operator surface — approvals, queue health, recovery, and provider status. Engineering diagnostics
                are collapsed by default.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthOutboundOperationsDashboard />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
