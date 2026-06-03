"use client"

import { use } from "react"
import { GitBranch } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthPatternEnrollmentDetail } from "@/components/growth/growth-pattern-enrollment-detail"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthPatternEnrollmentDetailPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>
}) {
  const { enrollmentId } = use(params)
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
              <GitBranch size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Sequence Enrollment</h1>
              <p className="text-sm text-muted-foreground">
                Pattern-based enrollment detail — scheduler, execution jobs, and approval workflow.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthPatternEnrollmentDetail enrollmentId={enrollmentId} />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
