"use client"

import { use } from "react"
import { Radar } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthAcquisitionRunDetail } from "@/components/growth/growth-acquisition-run-detail"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

type PageProps = {
  params: Promise<{ runId: string }>
}

export default function AdminGrowthAcquisitionRunPage({ params }: PageProps) {
  const { runId } = use(params)
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
            <span className="flex size-9 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <Radar size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Acquisition Run</h1>
              <p className="text-sm text-muted-foreground">
                Monitor throughput, pause or resume processing, and inspect discovered artifacts.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthAcquisitionRunDetail runId={runId} />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
