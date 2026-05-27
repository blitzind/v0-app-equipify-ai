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
      <div className="mx-auto flex max-w-[1700px] flex-col gap-6 px-6 py-8 xl:px-8">
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/70">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Headphones size={18} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Call Workspace</h1>
              <p className="text-sm text-muted-foreground">
                Native dialer with live coaching, prospect intelligence, and operator wrap-up — operator controlled.
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
