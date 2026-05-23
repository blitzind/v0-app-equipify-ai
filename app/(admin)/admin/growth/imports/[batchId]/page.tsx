"use client"

import { use } from "react"
import { Upload } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthImportBatchWizard } from "@/components/growth/growth-import-batch-wizard"
import { GrowthLeadsSubnav } from "@/components/growth/growth-leads-subnav"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthImportBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params)
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
            <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Upload size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Import Batch</h1>
              <p className="text-sm text-muted-foreground">
                Map columns, validate rows, dry-run dedupe, and commit leads.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <GrowthLeadsSubnav />
          </div>
        </section>

        <GrowthImportBatchWizard batchId={batchId} />
      </div>
    </PlatformAdminPageShell>
  )
}
