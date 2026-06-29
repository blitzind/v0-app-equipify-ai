"use client"

import { Chrome } from "lucide-react"
import { GrowthNotificationPushSubscribe } from "@/components/growth/notifications/growth-notification-push-subscribe"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"

export const GROWTH_SETTINGS_BROWSER_NOTIFICATIONS_PAGE_QA_MARKER =
  "growth-settings-browser-notifications-wiring-1a-v1" as const

export function GrowthSettingsBrowserNotificationsPage() {
  return (
    <div
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-qa-marker={GROWTH_SETTINGS_BROWSER_NOTIFICATIONS_PAGE_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Browser Notifications"
        description="Enable desktop push notifications for live alerts in this browser."
        icon={Chrome}
        iconClassName="bg-slate-100 text-slate-600 dark:bg-muted dark:text-foreground"
      />
      <GrowthNotificationPushSubscribe />
    </div>
  )
}
