"use client"

import { Suspense } from "react"
import { Flame } from "lucide-react"
import { GrowthWarmupDashboardPanel } from "@/components/growth/growth-warmup-dashboard"
import { GrowthCommunicationsSettingsSection } from "@/components/growth/settings/growth-communications-settings-section"

export default function GrowthCommunicationsWarmupPage() {
  return (
    <GrowthCommunicationsSettingsSection
      title="Mailbox Warmup"
      description="Native warmup uses approved sequence sends, progression schedules, daily caps, pre-send guards, and reputation tracking."
      icon={Flame}
      iconClassName="bg-orange-50 text-orange-700"
      adminFallbackHref="/admin/growth/infrastructure/warmup"
    >
      <Suspense
        fallback={
          <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
            Loading warmup dashboard…
          </div>
        }
      >
        <GrowthWarmupDashboardPanel />
      </Suspense>
    </GrowthCommunicationsSettingsSection>
  )
}
