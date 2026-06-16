"use client"

import { Bell } from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import { GrowthNotificationCenter } from "@/components/growth/notifications/growth-notification-center"
import { GrowthNotificationPushSubscribe } from "@/components/growth/notifications/growth-notification-push-subscribe"
import { GrowthNotificationAnalyticsSection } from "@/components/growth/notifications/growth-notification-analytics-section"
import { GrowthNotificationPreferencesPanel } from "@/components/growth/notifications/growth-notification-preferences-panel"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

export default function AdminGrowthNotificationsPage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
        <PlatformAdminTabNav activeKey="growth_leads" />

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
              <Bell size={17} />
            </span>
            <div>
              <h1 className={PAGE_STANDARD_PAGE_TITLE}>Notifications</h1>
              <p className="text-sm text-muted-foreground">
                Operator notification center for persisted Growth events. Acknowledge, dismiss, and configure delivery
                preferences — no email, SMS, or autonomous actions.
              </p>
            </div>
          </div>
        </section>

        <GrowthSectionLayout>
          <div className="space-y-4">
            <GrowthNotificationAnalyticsSection />
            <GrowthNotificationPreferencesPanel />
            <GrowthNotificationPushSubscribe />
            <GrowthNotificationCenter />
          </div>
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
