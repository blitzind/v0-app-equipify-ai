"use client"

import Link from "next/link"
import { Archive } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthOutreachApprovalDashboard } from "@/components/growth/growth-outreach-approval-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import {
  GROWTH_ADAPTER_ROLLBACK_SEQUENCE_EXECUTION_HREF,
  GROWTH_LEMLIST_DECOMMISSION_QA_MARKER,
  GROWTH_LEMLIST_ROLLBACK_ONLY_OPERATOR_NOTE,
} from "@/lib/growth/runtime/adapter-outbound-decommission-types"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthLegacyOutreachQueuePage() {
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
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <Archive size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Legacy Outreach Queue (read-only)</h1>
              <p className="text-sm text-muted-foreground">
                {GROWTH_LEMLIST_ROLLBACK_ONLY_OPERATOR_NOTE} Approve new sends at{" "}
                <Link className="underline" href={GROWTH_ADAPTER_ROLLBACK_SEQUENCE_EXECUTION_HREF}>
                  Sequence Execution
                </Link>
                .
              </p>
              <p className="text-xs text-muted-foreground mt-1">{GROWTH_LEMLIST_DECOMMISSION_QA_MARKER}</p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthOutreachApprovalDashboard readOnly />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
