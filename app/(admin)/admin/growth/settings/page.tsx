"use client"

import { Suspense } from "react"
import { Settings2 } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthCommunicationSettingsPanel } from "@/components/growth/growth-communication-settings"
import { GrowthAiCopilotSettingsPanel } from "@/components/growth/growth-ai-copilot-settings"
import { GrowthLiveCoachingSettingsPanel } from "@/components/growth/growth-live-coaching-settings"
import { GrowthGoogleCalendarSettingsPanel } from "@/components/growth/growth-google-calendar-settings-panel"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthSettingsPage() {
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
              <Settings2 size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Communication Settings</h1>
              <p className="text-sm text-muted-foreground">
                Provider selection, call dial preferences, and connection cost metadata — config only, no send or telephony APIs.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <Suspense fallback={null}>
            <GrowthGoogleCalendarSettingsPanel />
          </Suspense>
          <GrowthCommunicationSettingsPanel />
          <GrowthAiCopilotSettingsPanel />
          <GrowthLiveCoachingSettingsPanel />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
