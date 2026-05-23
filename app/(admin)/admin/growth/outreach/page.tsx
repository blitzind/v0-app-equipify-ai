"use client"

import { useRouter } from "next/navigation"
import { Mail } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthOutreachCenter } from "@/components/growth/growth-outreach-center"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthOutreachPage() {
  const router = useRouter()
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
              <Mail size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Outreach Center</h1>
              <p className="text-sm text-muted-foreground">
                Provider-agnostic outbound event tracking — fixture processor and unresolved webhook queue.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthOutreachCenter onProcessFixture={() => router.refresh()} />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
