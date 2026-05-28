"use client"

import { Sparkles } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthEngineSettingsPanel } from "@/components/growth/growth-engine-settings-panel"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthEngineSettingsPage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6">
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 dark:ring-[#25324C]/80">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
              <Sparkles size={16} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Growth</h1>
              <p className="text-xs text-muted-foreground">
                Global Growth Engine behavior, safeguards, and operating rules — not channel or provider setup.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <GrowthEngineSettingsPanel />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
