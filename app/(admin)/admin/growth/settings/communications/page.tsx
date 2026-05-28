"use client"

import { Suspense } from "react"
import { Mail } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthCommunicationSettingsPanel } from "@/components/growth/growth-communication-settings"
import { GrowthNativeDialerSettingsPanel } from "@/components/growth/growth-native-dialer-settings-panel"
import { GrowthVoiceInfrastructureSettingsPanel } from "@/components/growth/growth-voice-infrastructure-settings-panel"
import { GrowthAiCopilotSettingsPanel } from "@/components/growth/growth-ai-copilot-settings"
import { GrowthLiveCoachingSettingsPanel } from "@/components/growth/growth-live-coaching-settings"
import { GrowthGoogleCalendarSettingsPanel } from "@/components/growth/growth-google-calendar-settings-panel"
import { GrowthBookingPagesPanel } from "@/components/growth/growth-booking-pages-panel"
import { GrowthMeetingLocationSettingsPanel } from "@/components/growth/growth-meeting-location-settings-panel"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthCommunicationsSettingsPage() {
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
            <span className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Mail size={16} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Communications</h1>
              <p className="text-xs text-muted-foreground">
                Calendar, booking, email, voice, dialer, and Copilot connection settings for your org.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <Suspense fallback={null}>
            <GrowthGoogleCalendarSettingsPanel />
          </Suspense>
          <Suspense fallback={null}>
            <GrowthMeetingLocationSettingsPanel />
          </Suspense>
          <Suspense fallback={null}>
            <GrowthBookingPagesPanel />
          </Suspense>
          <GrowthCommunicationSettingsPanel />
          <GrowthVoiceInfrastructureSettingsPanel />
          <GrowthNativeDialerSettingsPanel />
          <GrowthAiCopilotSettingsPanel />
          <GrowthLiveCoachingSettingsPanel />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
