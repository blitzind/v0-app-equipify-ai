"use client"

import { Suspense } from "react"
import { Headphones } from "lucide-react"
import { GrowthCallWorkspace } from "@/components/growth/growth-call-workspace"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { useAdmin } from "@/lib/admin-store"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

function WorkspaceFallback() {
  return <p className="text-sm text-muted-foreground">Loading call workspace…</p>
}

export default function AdminGrowthCallWorkspacePage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-6 py-8 xl:px-8">
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Headphones size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Call Workspace</h1>
              <p className="text-sm text-muted-foreground">
                Native dialer with live coaching, prospect intelligence, and operator wrap-up — no autonomous dialing.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <Suspense fallback={<WorkspaceFallback />}>
            <GrowthCallWorkspace />
          </Suspense>
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
