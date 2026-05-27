import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthSenderPoolsDashboardView } from "@/components/growth/growth-sender-pools-dashboard"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
} from "@/components/admin/platform-admin-shell"

export default function GrowthSenderPoolsPage() {
  return (
    <PlatformAdminPageShell>
      <PlatformAdminTabNav activeKey="growth_leads" />
      <GrowthSectionLayout
        title="Sender Pools"
        description="Intelligent sender rotation across connected accounts — protects deliverability with health, reputation, and volume balancing. Human approval still required for every send."
      >
        <GrowthSenderPoolsDashboardView />
      </GrowthSectionLayout>
    </PlatformAdminPageShell>
  )
}
