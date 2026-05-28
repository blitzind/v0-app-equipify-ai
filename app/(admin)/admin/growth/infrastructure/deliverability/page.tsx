"use client"

import { ShieldCheck } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthDeliverabilityDashboard } from "@/components/growth/growth-deliverability-dashboard"
import { GrowthDeliverabilityIaNav } from "@/components/growth/growth-deliverability-ia-nav"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import { GROWTH_OPERATOR_UX_H3_QA_MARKER } from "@/lib/growth/operator-ux/operator-ux-h3-types"

export default function AdminGrowthDeliverabilityPage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8" data-h3-qa={GROWTH_OPERATOR_UX_H3_QA_MARKER}>
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <ShieldCheck size={17} />
              </span>
              <div>
                <h1 className={PAGE_STANDARD_PAGE_TITLE}>DNS &amp; Setup</h1>
                <p className="text-sm text-muted-foreground">
                  DNS validation, authentication coverage, and mailbox warmup — infrastructure setup only.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <GrowthDeliverabilityIaNav active="infrastructure" />
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthDeliverabilityDashboard />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
